"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIValidator = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const types_1 = require("../types");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class CLIValidator {
    constructor() {
        this.validationCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm CLI Validator');
    }
    async validateCLI() {
        const cacheKey = 'ruv-swarm-cli';
        const cached = this.validationCache.get(cacheKey);
        if (cached && this.isCacheValid(cacheKey)) {
            return cached;
        }
        this.outputChannel.appendLine('🔍 Validating ruv-swarm CLI...');
        const result = {
            isAvailable: false,
            capabilities: [],
            errors: [],
            warnings: [],
            recommendations: []
        };
        try {
            // Check if ruv-swarm is available
            const versionResult = await this.executeWithRetry({
                command: 'npx',
                args: ['ruv-swarm', '--version'],
                timeout: 10000,
                retries: 2
            });
            if (versionResult.success) {
                result.isAvailable = true;
                result.version = this.parseVersion(versionResult.stdout);
                this.outputChannel.appendLine(`✅ ruv-swarm CLI found: ${result.version}`);
            }
            // Check capabilities
            if (result.isAvailable) {
                await this.checkCapabilities(result);
            }
            // Validate environment
            await this.validateEnvironment(result);
            // Check dependencies
            await this.checkDependencies(result);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(`CLI validation failed: ${errorMessage}`);
            this.outputChannel.appendLine(`❌ CLI validation error: ${errorMessage}`);
        }
        // Cache result
        this.validationCache.set(cacheKey, result);
        this.setCacheTimestamp(cacheKey);
        // Generate recommendations
        this.generateRecommendations(result);
        return result;
    }
    async executeCommand(cliCommand) {
        const startTime = Date.now();
        try {
            const result = await this.executeWithRetry(cliCommand);
            // Validate output if validator provided
            if (cliCommand.validateOutput && !cliCommand.validateOutput(result.stdout)) {
                throw new types_1.SwarmError('Command output validation failed', 'OUTPUT_VALIDATION_FAILED');
            }
            // Parse output if parser provided
            let parsedOutput;
            if (cliCommand.parseOutput) {
                try {
                    parsedOutput = cliCommand.parseOutput(result.stdout);
                }
                catch (parseError) {
                    this.outputChannel.appendLine(`⚠️ Failed to parse command output: ${parseError}`);
                }
            }
            const duration = Date.now() - startTime;
            this.outputChannel.appendLine(`✅ Command executed successfully in ${duration}ms: ${cliCommand.command} ${cliCommand.args.join(' ')}`);
            return {
                success: true,
                stdout: result.stdout,
                stderr: result.stderr,
                parsedOutput,
                duration
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Command failed after ${duration}ms: ${cliCommand.command} ${cliCommand.args.join(' ')} - ${errorMessage}`);
            return {
                success: false,
                stdout: '',
                stderr: errorMessage,
                duration
            };
        }
    }
    async validateWorkspace() {
        const result = {
            isValid: true,
            issues: [],
            suggestions: []
        };
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            result.isValid = false;
            result.issues.push('No workspace folder found');
            result.suggestions.push('Open a folder or workspace to use RUV-Swarm');
            return result;
        }
        try {
            // Check if workspace has package.json
            const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
            try {
                await vscode.workspace.fs.stat(packageJsonUri);
                this.outputChannel.appendLine('✅ package.json found in workspace');
            }
            catch {
                result.suggestions.push('Consider adding a package.json file for better dependency management');
            }
            // Check if ruv-swarm is installed locally
            const nodeModulesUri = vscode.Uri.joinPath(workspaceFolder.uri, 'node_modules', 'ruv-swarm');
            try {
                await vscode.workspace.fs.stat(nodeModulesUri);
                this.outputChannel.appendLine('✅ ruv-swarm found in local node_modules');
            }
            catch {
                result.suggestions.push('Consider installing ruv-swarm locally: npm install ruv-swarm');
            }
            // Check workspace permissions
            try {
                const testUri = vscode.Uri.joinPath(workspaceFolder.uri, '.ruv-swarm-test');
                await vscode.workspace.fs.writeFile(testUri, new Uint8Array());
                await vscode.workspace.fs.delete(testUri);
                this.outputChannel.appendLine('✅ Workspace has write permissions');
            }
            catch {
                result.isValid = false;
                result.issues.push('Workspace does not have write permissions');
                result.suggestions.push('Ensure the workspace folder has write permissions');
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.issues.push(`Workspace validation error: ${errorMessage}`);
        }
        return result;
    }
    async executeWithRetry(cliCommand) {
        let lastError = null;
        for (let attempt = 0; attempt <= cliCommand.retries; attempt++) {
            try {
                const { stdout, stderr } = await execAsync(`${cliCommand.command} ${cliCommand.args.join(' ')}`, {
                    timeout: cliCommand.timeout,
                    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                });
                return {
                    success: true,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                };
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < cliCommand.retries) {
                    const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                    this.outputChannel.appendLine(`⚠️ Command failed (attempt ${attempt + 1}/${cliCommand.retries + 1}), retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError || new Error('Command execution failed');
    }
    async checkCapabilities(result) {
        const capabilities = [
            { name: 'init', command: ['ruv-swarm', 'init', '--help'] },
            { name: 'agent', command: ['ruv-swarm', 'agent', '--help'] },
            { name: 'task', command: ['ruv-swarm', 'task', '--help'] },
            { name: 'monitor', command: ['ruv-swarm', 'monitor', '--help'] },
            { name: 'benchmark', command: ['ruv-swarm', 'benchmark', '--help'] }
        ];
        for (const capability of capabilities) {
            try {
                const capabilityResult = await this.executeWithRetry({
                    command: 'npx',
                    args: capability.command,
                    timeout: 5000,
                    retries: 1
                });
                if (capabilityResult.success) {
                    result.capabilities.push(capability.name);
                    this.outputChannel.appendLine(`✅ Capability available: ${capability.name}`);
                }
            }
            catch {
                this.outputChannel.appendLine(`⚠️ Capability not available: ${capability.name}`);
            }
        }
    }
    async validateEnvironment(result) {
        // Check Node.js version
        try {
            const nodeResult = await this.executeWithRetry({
                command: 'node',
                args: ['--version'],
                timeout: 5000,
                retries: 1
            });
            if (nodeResult.success) {
                const nodeVersion = nodeResult.stdout.replace('v', '');
                const majorVersion = parseInt(nodeVersion.split('.')[0]);
                if (majorVersion < 16) {
                    result.warnings.push(`Node.js version ${nodeVersion} is below recommended minimum (16.0.0)`);
                }
                else {
                    this.outputChannel.appendLine(`✅ Node.js version: ${nodeVersion}`);
                }
            }
        }
        catch {
            result.errors.push('Node.js not found or not accessible');
        }
        // Check npm version
        try {
            const npmResult = await this.executeWithRetry({
                command: 'npm',
                args: ['--version'],
                timeout: 5000,
                retries: 1
            });
            if (npmResult.success) {
                this.outputChannel.appendLine(`✅ npm version: ${npmResult.stdout}`);
            }
        }
        catch {
            result.warnings.push('npm not found - may affect package installation');
        }
    }
    async checkDependencies(result) {
        const dependencies = ['typescript', 'webpack', 'esbuild'];
        for (const dep of dependencies) {
            try {
                await this.executeWithRetry({
                    command: 'npx',
                    args: [dep, '--version'],
                    timeout: 5000,
                    retries: 1
                });
                this.outputChannel.appendLine(`✅ Optional dependency available: ${dep}`);
            }
            catch {
                // Optional dependencies - don't add to errors
                this.outputChannel.appendLine(`ℹ️ Optional dependency not available: ${dep}`);
            }
        }
    }
    parseVersion(output) {
        // Extract version from output (format may vary)
        const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
        return versionMatch ? versionMatch[1] : output.trim();
    }
    generateRecommendations(result) {
        if (!result.isAvailable) {
            result.recommendations.push('Install ruv-swarm: npm install -g ruv-swarm');
            result.recommendations.push('Or use npx: npx ruv-swarm --version');
        }
        if (result.capabilities.length < 3) {
            result.recommendations.push('Update ruv-swarm to the latest version for full functionality');
        }
        if (result.warnings.length > 0) {
            result.recommendations.push('Address environment warnings for optimal performance');
        }
        if (result.errors.length === 0 && result.warnings.length === 0) {
            result.recommendations.push('CLI environment is optimal - no action needed');
        }
    }
    isCacheValid(key) {
        const timestamp = this.getCacheTimestamp(key);
        return timestamp !== null && (Date.now() - timestamp) < this.cacheExpiry;
    }
    setCacheTimestamp(key) {
        this.validationCache.set(`${key}_timestamp`, Date.now());
    }
    getCacheTimestamp(key) {
        const timestamp = this.validationCache.get(`${key}_timestamp`);
        return typeof timestamp === 'number' ? timestamp : null;
    }
    clearCache() {
        this.validationCache.clear();
        this.outputChannel.appendLine('🗑️ CLI validation cache cleared');
    }
    dispose() {
        this.outputChannel.dispose();
        this.validationCache.clear();
    }
}
exports.CLIValidator = CLIValidator;
//# sourceMappingURL=cliValidator.js.map