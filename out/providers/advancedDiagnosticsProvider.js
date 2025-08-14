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
exports.AdvancedDiagnosticsProvider = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class AdvancedDiagnosticsProvider {
    constructor(swarmManager, errorHandler) {
        this.rules = new Map();
        this.fixSuggestions = new Map();
        this.analysisCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.swarmManager = swarmManager;
        this.errorHandler = errorHandler;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ruv-swarm-advanced');
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Advanced Diagnostics');
        this.initializeDefaultRules();
    }
    async initialize() {
        try {
            this.outputChannel.appendLine('🔍 Initializing Advanced Diagnostics Provider...');
            // Load custom rules from configuration
            await this.loadCustomRules();
            // Register code action provider
            this.registerCodeActionProvider();
            this.outputChannel.appendLine('✅ Advanced Diagnostics Provider initialized successfully');
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'DIAGNOSTICS_INIT',
                    component: 'AdvancedDiagnosticsProvider'
                }, { severity: 'high' });
            }
        }
    }
    async analyzeDocument(document) {
        const filePath = document.uri.fsPath;
        const language = document.languageId;
        // Check cache first
        const cached = this.analysisCache.get(filePath);
        if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
            return cached.diagnostics;
        }
        try {
            this.outputChannel.appendLine(`🔍 Analyzing document: ${path.basename(filePath)}`);
            const context = await this.createDiagnosticContext(document);
            const diagnostics = [];
            // Run rule-based analysis
            const ruleBasedDiagnostics = await this.runRuleBasedAnalysis(context);
            diagnostics.push(...ruleBasedDiagnostics);
            // Run AI-powered analysis
            const aiDiagnostics = await this.runAIAnalysis(context);
            diagnostics.push(...aiDiagnostics);
            // Run language-specific analysis
            const languageSpecificDiagnostics = await this.runLanguageSpecificAnalysis(context);
            diagnostics.push(...languageSpecificDiagnostics);
            // Cache results
            this.analysisCache.set(filePath, {
                diagnostics,
                timestamp: new Date()
            });
            // Update VSCode diagnostics
            await this.updateVSCodeDiagnostics(document.uri, diagnostics);
            this.outputChannel.appendLine(`✅ Analysis completed: ${diagnostics.length} issues found`);
            return diagnostics;
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'ANALYZE_DOCUMENT',
                    component: 'AdvancedDiagnosticsProvider',
                    filePath
                }, { severity: 'medium' });
            }
            return [];
        }
    }
    async batchAnalyzeWorkspace() {
        const results = new Map();
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return results;
            }
            this.outputChannel.appendLine('📊 Starting batch workspace analysis...');
            for (const folder of workspaceFolders) {
                const files = await this.findAnalyzableFiles(folder);
                for (const file of files) {
                    try {
                        const document = await vscode.workspace.openTextDocument(file);
                        const diagnostics = await this.analyzeDocument(document);
                        results.set(file.fsPath, diagnostics);
                    }
                    catch (error) {
                        this.outputChannel.appendLine(`⚠️ Failed to analyze ${file.fsPath}: ${error}`);
                    }
                }
            }
            this.outputChannel.appendLine(`✅ Batch analysis completed: ${results.size} files analyzed`);
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'BATCH_ANALYZE_WORKSPACE',
                    component: 'AdvancedDiagnosticsProvider'
                }, { severity: 'medium' });
            }
        }
        return results;
    }
    addCustomRule(rule) {
        this.rules.set(rule.id, rule);
        this.outputChannel.appendLine(`📋 Added custom rule: ${rule.name}`);
    }
    removeRule(ruleId) {
        const removed = this.rules.delete(ruleId);
        if (removed) {
            this.outputChannel.appendLine(`🗑️ Removed rule: ${ruleId}`);
        }
        return removed;
    }
    enableRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = true;
            this.outputChannel.appendLine(`✅ Enabled rule: ${rule.name}`);
            return true;
        }
        return false;
    }
    disableRule(ruleId) {
        const rule = this.rules.get(ruleId);
        if (rule) {
            rule.enabled = false;
            this.outputChannel.appendLine(`⏸️ Disabled rule: ${rule.name}`);
            return true;
        }
        return false;
    }
    getRules() {
        return Array.from(this.rules.values());
    }
    getEnabledRules() {
        return Array.from(this.rules.values()).filter(rule => rule.enabled);
    }
    addFixSuggestion(diagnosticId, suggestion) {
        if (!this.fixSuggestions.has(diagnosticId)) {
            this.fixSuggestions.set(diagnosticId, []);
        }
        this.fixSuggestions.get(diagnosticId).push(suggestion);
    }
    getFixSuggestions(diagnosticId) {
        return this.fixSuggestions.get(diagnosticId) || [];
    }
    clearDiagnostics(filePath) {
        if (filePath) {
            const uri = vscode.Uri.file(filePath);
            this.diagnosticCollection.delete(uri);
            this.analysisCache.delete(filePath);
        }
        else {
            this.diagnosticCollection.clear();
            this.analysisCache.clear();
        }
    }
    async createDiagnosticContext(document) {
        const filePath = document.uri.fsPath;
        const language = document.languageId;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        return {
            filePath,
            language,
            document,
            workspaceFolder,
            projectType: await this.detectProjectType(workspaceFolder),
            dependencies: await this.extractDependencies(document)
        };
    }
    async runRuleBasedAnalysis(context) {
        const diagnostics = [];
        const enabledRules = this.getEnabledRules()
            .filter(rule => rule.languages.includes(context.language))
            .sort((a, b) => b.priority - a.priority);
        for (const rule of enabledRules) {
            try {
                const ruleDiagnostics = await this.applyRule(rule, context);
                diagnostics.push(...ruleDiagnostics);
            }
            catch (error) {
                this.outputChannel.appendLine(`⚠️ Error applying rule ${rule.id}: ${error}`);
            }
        }
        return diagnostics;
    }
    async applyRule(rule, context) {
        const diagnostics = [];
        const text = context.document.getText();
        if (rule.customCheck) {
            // Use custom check function
            const customDiagnostics = await rule.customCheck(text, context.filePath);
            diagnostics.push(...customDiagnostics);
        }
        else if (rule.pattern) {
            // Use regex pattern
            const matches = text.matchAll(rule.pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    const position = context.document.positionAt(match.index);
                    const diagnostic = {
                        severity: rule.severity,
                        message: `${rule.name}: ${rule.description}`,
                        line: position.line,
                        column: position.character,
                        endLine: position.line,
                        endColumn: position.character + match[0].length,
                        source: 'ruv-swarm-advanced',
                        category: rule.category,
                        code: rule.id
                    };
                    diagnostics.push(diagnostic);
                }
            }
        }
        return diagnostics;
    }
    async runAIAnalysis(context) {
        try {
            const description = `Perform advanced code analysis on ${context.filePath} for potential issues, bugs, and improvements`;
            const result = await this.swarmManager.executeTask(description, 'analysis', context.filePath);
            return this.parseAIAnalysisResult(result, context);
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ AI analysis failed: ${error}`);
            return [];
        }
    }
    parseAIAnalysisResult(result, context) {
        const diagnostics = [];
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(result);
            if (parsed.diagnostics && Array.isArray(parsed.diagnostics)) {
                return parsed.diagnostics;
            }
        }
        catch {
            // Fall back to text parsing
        }
        // Parse text-based AI output
        const lines = result.split('\n');
        for (const line of lines) {
            const criticalMatch = line.match(/🔴\s*Critical:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const errorMatch = line.match(/❌\s*Error:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const warningMatch = line.match(/⚠️\s*Warning:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const infoMatch = line.match(/💡\s*Info:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            if (criticalMatch) {
                diagnostics.push({
                    severity: 'error',
                    message: criticalMatch[1].trim(),
                    line: criticalMatch[2] ? parseInt(criticalMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-ai',
                    category: 'logic',
                    code: 'AI_CRITICAL'
                });
            }
            else if (errorMatch) {
                diagnostics.push({
                    severity: 'error',
                    message: errorMatch[1].trim(),
                    line: errorMatch[2] ? parseInt(errorMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-ai',
                    category: 'logic',
                    code: 'AI_ERROR'
                });
            }
            else if (warningMatch) {
                diagnostics.push({
                    severity: 'warning',
                    message: warningMatch[1].trim(),
                    line: warningMatch[2] ? parseInt(warningMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-ai',
                    category: 'maintainability',
                    code: 'AI_WARNING'
                });
            }
            else if (infoMatch) {
                diagnostics.push({
                    severity: 'info',
                    message: infoMatch[1].trim(),
                    line: infoMatch[2] ? parseInt(infoMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-ai',
                    category: 'style',
                    code: 'AI_INFO'
                });
            }
        }
        return diagnostics;
    }
    async runLanguageSpecificAnalysis(context) {
        switch (context.language) {
            case 'typescript':
            case 'javascript':
                return await this.analyzeJavaScript(context);
            case 'python':
                return await this.analyzePython(context);
            case 'rust':
                return await this.analyzeRust(context);
            default:
                return [];
        }
    }
    async analyzeJavaScript(context) {
        const diagnostics = [];
        const text = context.document.getText();
        // Check for common JavaScript issues
        const issues = [
            {
                pattern: /console\.log\(/g,
                message: 'Console.log statement found - consider removing for production',
                severity: 'warning',
                category: 'maintainability'
            },
            {
                pattern: /var\s+\w+/g,
                message: 'Use let or const instead of var',
                severity: 'warning',
                category: 'style'
            },
            {
                pattern: /==\s*(?!null)/g,
                message: 'Use strict equality (===) instead of loose equality (==)',
                severity: 'warning',
                category: 'logic'
            }
        ];
        for (const issue of issues) {
            const matches = text.matchAll(issue.pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    const position = context.document.positionAt(match.index);
                    diagnostics.push({
                        severity: issue.severity,
                        message: issue.message,
                        line: position.line,
                        column: position.character,
                        source: 'ruv-swarm-js',
                        category: issue.category,
                        code: 'JS_BEST_PRACTICE'
                    });
                }
            }
        }
        return diagnostics;
    }
    async analyzePython(context) {
        const diagnostics = [];
        const text = context.document.getText();
        // Check for common Python issues
        const issues = [
            {
                pattern: /print\(/g,
                message: 'Print statement found - consider using logging instead',
                severity: 'info',
                category: 'maintainability'
            },
            {
                pattern: /except:/g,
                message: 'Bare except clause - specify exception type',
                severity: 'warning',
                category: 'logic'
            }
        ];
        for (const issue of issues) {
            const matches = text.matchAll(issue.pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    const position = context.document.positionAt(match.index);
                    diagnostics.push({
                        severity: issue.severity,
                        message: issue.message,
                        line: position.line,
                        column: position.character,
                        source: 'ruv-swarm-python',
                        category: issue.category,
                        code: 'PY_BEST_PRACTICE'
                    });
                }
            }
        }
        return diagnostics;
    }
    async analyzeRust(context) {
        const diagnostics = [];
        const text = context.document.getText();
        // Check for common Rust issues
        const issues = [
            {
                pattern: /println!\(/g,
                message: 'Debug print found - consider removing for production',
                severity: 'info',
                category: 'maintainability'
            },
            {
                pattern: /\.unwrap\(\)/g,
                message: 'Consider proper error handling instead of unwrap()',
                severity: 'warning',
                category: 'logic'
            }
        ];
        for (const issue of issues) {
            const matches = text.matchAll(issue.pattern);
            for (const match of matches) {
                if (match.index !== undefined) {
                    const position = context.document.positionAt(match.index);
                    diagnostics.push({
                        severity: issue.severity,
                        message: issue.message,
                        line: position.line,
                        column: position.character,
                        source: 'ruv-swarm-rust',
                        category: issue.category,
                        code: 'RUST_BEST_PRACTICE'
                    });
                }
            }
        }
        return diagnostics;
    }
    async updateVSCodeDiagnostics(uri, diagnostics) {
        const vscDiagnostics = diagnostics.map(diag => this.convertToVSCodeDiagnostic(diag));
        this.diagnosticCollection.set(uri, vscDiagnostics);
    }
    convertToVSCodeDiagnostic(diagnostic) {
        const range = new vscode.Range(diagnostic.line, diagnostic.column, diagnostic.endLine || diagnostic.line, diagnostic.endColumn || diagnostic.column + 1);
        const severity = this.convertSeverity(diagnostic.severity);
        const vscDiagnostic = new vscode.Diagnostic(range, diagnostic.message, severity);
        vscDiagnostic.source = diagnostic.source;
        vscDiagnostic.code = diagnostic.code;
        return vscDiagnostic;
    }
    convertSeverity(severity) {
        switch (severity) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': return vscode.DiagnosticSeverity.Information;
            case 'hint': return vscode.DiagnosticSeverity.Hint;
            default: return vscode.DiagnosticSeverity.Information;
        }
    }
    async detectProjectType(workspaceFolder) {
        if (!workspaceFolder) {
            return undefined;
        }
        const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
        const cargoTomlUri = vscode.Uri.joinPath(workspaceFolder.uri, 'Cargo.toml');
        const requirementsTxtUri = vscode.Uri.joinPath(workspaceFolder.uri, 'requirements.txt');
        try {
            await vscode.workspace.fs.stat(packageJsonUri);
            return 'node';
        }
        catch { }
        try {
            await vscode.workspace.fs.stat(cargoTomlUri);
            return 'rust';
        }
        catch { }
        try {
            await vscode.workspace.fs.stat(requirementsTxtUri);
            return 'python';
        }
        catch { }
        return 'unknown';
    }
    async extractDependencies(document) {
        const dependencies = [];
        const text = document.getText();
        // Extract import/require statements
        const importRegex = /(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)|use\s+([^;]+);)/g;
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            const dep = match[1] || match[2] || match[3];
            if (dep && !dep.startsWith('.')) {
                dependencies.push(dep.split('/')[0]); // Get package name
            }
        }
        return [...new Set(dependencies)]; // Remove duplicates
    }
    async findAnalyzableFiles(workspaceFolder) {
        const patterns = [
            '**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx',
            '**/*.py', '**/*.rs', '**/*.go', '**/*.java',
            '**/*.cs', '**/*.php', '**/*.rb'
        ];
        const excludePatterns = [
            '**/node_modules/**', '**/target/**', '**/build/**',
            '**/dist/**', '**/.git/**', '**/coverage/**'
        ];
        const files = [];
        for (const pattern of patterns) {
            const foundFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceFolder, pattern), `{${excludePatterns.join(',')}}`);
            files.push(...foundFiles);
        }
        return files;
    }
    initializeDefaultRules() {
        // Security rules
        this.addCustomRule({
            id: 'hardcoded-secrets',
            name: 'Hardcoded Secrets',
            description: 'Potential hardcoded secrets or API keys',
            category: 'security',
            severity: 'error',
            languages: ['javascript', 'typescript', 'python', 'java', 'csharp'],
            pattern: /(api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
            enabled: true,
            priority: 10
        });
        // Performance rules
        this.addCustomRule({
            id: 'inefficient-loop',
            name: 'Inefficient Loop',
            description: 'Potentially inefficient loop pattern',
            category: 'performance',
            severity: 'warning',
            languages: ['javascript', 'typescript'],
            pattern: /for\s*\(\s*var\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+\.length\s*;\s*\w+\+\+\s*\)/g,
            enabled: true,
            priority: 5
        });
        // Maintainability rules
        this.addCustomRule({
            id: 'long-function',
            name: 'Long Function',
            description: 'Function is too long and should be refactored',
            category: 'maintainability',
            severity: 'info',
            languages: ['javascript', 'typescript', 'python'],
            customCheck: async (text, filePath) => {
                const diagnostics = [];
                const lines = text.split('\n');
                let inFunction = false;
                let functionStart = 0;
                let braceCount = 0;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    if (/function\s+\w+|def\s+\w+|const\s+\w+\s*=\s*\(/.test(line)) {
                        inFunction = true;
                        functionStart = i;
                        braceCount = 0;
                    }
                    if (inFunction) {
                        braceCount += (line.match(/\{/g) || []).length;
                        braceCount -= (line.match(/\}/g) || []).length;
                        if (braceCount === 0 && i > functionStart) {
                            const functionLength = i - functionStart + 1;
                            if (functionLength > 50) {
                                diagnostics.push({
                                    severity: 'info',
                                    message: `Function is ${functionLength} lines long. Consider refactoring.`,
                                    line: functionStart,
                                    column: 0,
                                    source: 'ruv-swarm-advanced',
                                    category: 'maintainability',
                                    code: 'LONG_FUNCTION'
                                });
                            }
                            inFunction = false;
                        }
                    }
                }
                return diagnostics;
            },
            enabled: true,
            priority: 3
        });
    }
    async loadCustomRules() {
        // Load custom rules from workspace configuration
        const config = vscode.workspace.getConfiguration('ruv-swarm.diagnostics');
        const customRules = config.get('customRules', []);
        for (const rule of customRules) {
            this.addCustomRule(rule);
        }
    }
    registerCodeActionProvider() {
        const provider = {
            provideCodeActions: (document, range, context) => {
                const actions = [];
                for (const diagnostic of context.diagnostics) {
                    if (diagnostic.source?.startsWith('ruv-swarm')) {
                        const suggestions = this.getFixSuggestions(diagnostic.code);
                        for (const suggestion of suggestions) {
                            const action = new vscode.CodeAction(suggestion.title, suggestion.kind);
                            action.edit = suggestion.edit;
                            action.command = suggestion.command;
                            action.isPreferred = suggestion.isPreferred;
                            actions.push(action);
                        }
                    }
                }
                return actions;
            }
        };
        vscode.languages.registerCodeActionsProvider('*', provider);
    }
    dispose() {
        this.diagnosticCollection.dispose();
        this.outputChannel.dispose();
        this.analysisCache.clear();
        this.rules.clear();
        this.fixSuggestions.clear();
    }
}
exports.AdvancedDiagnosticsProvider = AdvancedDiagnosticsProvider;
//# sourceMappingURL=advancedDiagnosticsProvider.js.map