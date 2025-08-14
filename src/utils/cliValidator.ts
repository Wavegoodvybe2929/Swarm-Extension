import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SwarmError } from '../types';

const execAsync = promisify(exec);

export interface CLIValidationResult {
    isAvailable: boolean;
    version?: string;
    capabilities: string[];
    errors: string[];
    warnings: string[];
    recommendations: string[];
}

export interface CLICommand {
    command: string;
    args: string[];
    timeout: number;
    retries: number;
    validateOutput?: (output: string) => boolean;
    parseOutput?: (output: string) => any;
}

export class CLIValidator implements vscode.Disposable {
    private outputChannel: vscode.OutputChannel;
    private validationCache: Map<string, CLIValidationResult> = new Map();
    private cacheExpiry = 5 * 60 * 1000; // 5 minutes

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm CLI Validator');
    }

    async validateCLI(): Promise<CLIValidationResult> {
        const cacheKey = 'ruv-swarm-cli';
        const cached = this.validationCache.get(cacheKey);
        
        if (cached && this.isCacheValid(cacheKey)) {
            return cached;
        }

        this.outputChannel.appendLine('🔍 Validating ruv-swarm CLI...');

        const result: CLIValidationResult = {
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

        } catch (error) {
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

    async executeCommand(cliCommand: CLICommand): Promise<{
        success: boolean;
        stdout: string;
        stderr: string;
        parsedOutput?: any;
        duration: number;
    }> {
        const startTime = Date.now();
        
        try {
            const result = await this.executeWithRetry(cliCommand);
            
            // Validate output if validator provided
            if (cliCommand.validateOutput && !cliCommand.validateOutput(result.stdout)) {
                throw new SwarmError('Command output validation failed', 'OUTPUT_VALIDATION_FAILED');
            }

            // Parse output if parser provided
            let parsedOutput;
            if (cliCommand.parseOutput) {
                try {
                    parsedOutput = cliCommand.parseOutput(result.stdout);
                } catch (parseError) {
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

        } catch (error) {
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

    async validateWorkspace(): Promise<{
        isValid: boolean;
        issues: string[];
        suggestions: string[];
    }> {
        const result = {
            isValid: true,
            issues: [] as string[],
            suggestions: [] as string[]
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
            } catch {
                result.suggestions.push('Consider adding a package.json file for better dependency management');
            }

            // Check if ruv-swarm is installed locally
            const nodeModulesUri = vscode.Uri.joinPath(workspaceFolder.uri, 'node_modules', 'ruv-swarm');
            try {
                await vscode.workspace.fs.stat(nodeModulesUri);
                this.outputChannel.appendLine('✅ ruv-swarm found in local node_modules');
            } catch {
                result.suggestions.push('Consider installing ruv-swarm locally: npm install ruv-swarm');
            }

            // Check workspace permissions
            try {
                const testUri = vscode.Uri.joinPath(workspaceFolder.uri, '.ruv-swarm-test');
                await vscode.workspace.fs.writeFile(testUri, new Uint8Array());
                await vscode.workspace.fs.delete(testUri);
                this.outputChannel.appendLine('✅ Workspace has write permissions');
            } catch {
                result.isValid = false;
                result.issues.push('Workspace does not have write permissions');
                result.suggestions.push('Ensure the workspace folder has write permissions');
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.issues.push(`Workspace validation error: ${errorMessage}`);
        }

        return result;
    }

    private async executeWithRetry(cliCommand: CLICommand): Promise<{
        success: boolean;
        stdout: string;
        stderr: string;
    }> {
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt <= cliCommand.retries; attempt++) {
            try {
                const { stdout, stderr } = await execAsync(
                    `${cliCommand.command} ${cliCommand.args.join(' ')}`,
                    {
                        timeout: cliCommand.timeout,
                        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                    }
                );

                return {
                    success: true,
                    stdout: stdout.trim(),
                    stderr: stderr.trim()
                };

            } catch (error) {
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

    private async checkCapabilities(result: CLIValidationResult): Promise<void> {
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
            } catch {
                this.outputChannel.appendLine(`⚠️ Capability not available: ${capability.name}`);
            }
        }
    }

    private async validateEnvironment(result: CLIValidationResult): Promise<void> {
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
                } else {
                    this.outputChannel.appendLine(`✅ Node.js version: ${nodeVersion}`);
                }
            }
        } catch {
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
        } catch {
            result.warnings.push('npm not found - may affect package installation');
        }
    }

    private async checkDependencies(result: CLIValidationResult): Promise<void> {
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
            } catch {
                // Optional dependencies - don't add to errors
                this.outputChannel.appendLine(`ℹ️ Optional dependency not available: ${dep}`);
            }
        }
    }

    private parseVersion(output: string): string {
        // Extract version from output (format may vary)
        const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
        return versionMatch ? versionMatch[1] : output.trim();
    }

    private generateRecommendations(result: CLIValidationResult): void {
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

    private isCacheValid(key: string): boolean {
        const timestamp = this.getCacheTimestamp(key);
        return timestamp !== null && (Date.now() - timestamp) < this.cacheExpiry;
    }

    private setCacheTimestamp(key: string): void {
        this.validationCache.set(`${key}_timestamp`, Date.now() as any);
    }

    private getCacheTimestamp(key: string): number | null {
        const timestamp = this.validationCache.get(`${key}_timestamp`) as any;
        return typeof timestamp === 'number' ? timestamp : null;
    }

    clearCache(): void {
        this.validationCache.clear();
        this.outputChannel.appendLine('🗑️ CLI validation cache cleared');
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.validationCache.clear();
    }
}
