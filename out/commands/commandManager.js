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
exports.CommandManager = void 0;
const vscode = __importStar(require("vscode"));
class CommandManager {
    constructor(swarmManager, diagnosticsProvider, statusBarManager) {
        this.swarmManager = swarmManager;
        this.diagnosticsProvider = diagnosticsProvider;
        this.statusBarManager = statusBarManager;
    }
    async initializeSwarm() {
        try {
            this.statusBarManager.updateStatus('initializing', 'Initializing Swarm...');
            await this.swarmManager.initializeSwarm();
            this.statusBarManager.updateStatus('ready', 'RUV-Swarm Ready');
            vscode.window.showInformationMessage('🧠 RUV-Swarm initialized successfully!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Initialization Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to initialize swarm: ${errorMessage}`);
        }
    }
    async spawnCodingAgent() {
        try {
            this.statusBarManager.updateStatus('busy', 'Spawning Agent...');
            const agentId = await this.swarmManager.spawnAgent('coder', 'vscode-assistant', ['code_analysis', 'refactoring', 'optimization']);
            this.statusBarManager.updateStatus('ready', 'Agent Ready');
            vscode.window.showInformationMessage(`🤖 Coding agent spawned: ${agentId}`);
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Agent Spawn Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to spawn agent: ${errorMessage}`);
        }
    }
    async analyzeCurrentFile() {
        const context = this.getCommandContext();
        if (!context.activeEditor) {
            vscode.window.showWarningMessage('No active file to analyze');
            return;
        }
        try {
            this.statusBarManager.updateStatus('analyzing', 'Analyzing File...');
            const filePath = context.activeEditor.filePath;
            const description = `Analyze ${filePath} for improvements, bugs, and optimization opportunities`;
            const result = await this.swarmManager.executeTask(description, 'analysis', filePath);
            // Parse and display results
            await this.diagnosticsProvider.processAnalysisResult(filePath, result);
            this.statusBarManager.updateStatus('ready', 'Analysis Complete');
            vscode.window.showInformationMessage('🔍 File analysis completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Analysis Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Analysis failed: ${errorMessage}`);
        }
    }
    async generateTests() {
        const context = this.getCommandContext();
        if (!context.activeEditor) {
            vscode.window.showWarningMessage('No active file to generate tests for');
            return;
        }
        try {
            this.statusBarManager.updateStatus('generating', 'Generating Tests...');
            const filePath = context.activeEditor.filePath;
            const description = `Generate comprehensive unit tests for ${filePath} including edge cases and mocking`;
            const result = await this.swarmManager.executeTask(description, 'generation', filePath);
            // Create test file
            await this.createTestFile(filePath, result);
            this.statusBarManager.updateStatus('ready', 'Tests Generated');
            vscode.window.showInformationMessage('🧪 Tests generated successfully!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Test Generation Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Test generation failed: ${errorMessage}`);
        }
    }
    async codeReview() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('No workspace folder found');
            return;
        }
        try {
            this.statusBarManager.updateStatus('reviewing', 'Performing Code Review...');
            const description = `Perform comprehensive code review of ${workspaceFolder.uri.fsPath} focusing on security, performance, and maintainability`;
            const result = await this.swarmManager.executeTask(description, 'review');
            // Show results in webview
            await this.showCodeReviewResults(result);
            this.statusBarManager.updateStatus('ready', 'Review Complete');
            vscode.window.showInformationMessage('👥 Code review completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Review Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Code review failed: ${errorMessage}`);
        }
    }
    async optimizePerformance() {
        const context = this.getCommandContext();
        if (!context.activeEditor) {
            vscode.window.showWarningMessage('No active file to optimize');
            return;
        }
        try {
            this.statusBarManager.updateStatus('optimizing', 'Optimizing Performance...');
            const filePath = context.activeEditor.filePath;
            const description = `Analyze ${filePath} for performance bottlenecks and suggest optimizations`;
            const result = await this.swarmManager.executeTask(description, 'optimization', filePath);
            // Show optimization suggestions
            await this.showOptimizationResults(result);
            this.statusBarManager.updateStatus('ready', 'Optimization Complete');
            vscode.window.showInformationMessage('⚡ Performance optimization completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Optimization Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Performance optimization failed: ${errorMessage}`);
        }
    }
    async securityAnalysis() {
        const context = this.getCommandContext();
        if (!context.activeEditor) {
            vscode.window.showWarningMessage('No active file to analyze');
            return;
        }
        try {
            this.statusBarManager.updateStatus('scanning', 'Security Analysis...');
            const filePath = context.activeEditor.filePath;
            const description = `Perform security analysis of ${filePath} and identify vulnerabilities`;
            const result = await this.swarmManager.executeTask(description, 'analysis', filePath);
            // Process security findings
            await this.diagnosticsProvider.processSecurityAnalysis(filePath, result);
            this.statusBarManager.updateStatus('ready', 'Security Scan Complete');
            vscode.window.showInformationMessage('🔒 Security analysis completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Security Scan Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Security analysis failed: ${errorMessage}`);
        }
    }
    async explainCode() {
        const context = this.getCommandContext();
        if (!context.activeEditor || !context.activeEditor.selection) {
            vscode.window.showWarningMessage('No code selected to explain');
            return;
        }
        try {
            this.statusBarManager.updateStatus('explaining', 'Explaining Code...');
            const filePath = context.activeEditor.filePath;
            const selectedText = context.activeEditor.text || '';
            const description = `Explain the following code with detailed comments and documentation:\n\n${selectedText}`;
            const result = await this.swarmManager.executeTask(description, 'explanation', filePath);
            // Show explanation in output channel
            await this.showCodeExplanation(result);
            this.statusBarManager.updateStatus('ready', 'Explanation Complete');
            vscode.window.showInformationMessage('📖 Code explanation completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Explanation Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Code explanation failed: ${errorMessage}`);
        }
    }
    async refactorCode() {
        const context = this.getCommandContext();
        if (!context.activeEditor) {
            vscode.window.showWarningMessage('No active file to refactor');
            return;
        }
        try {
            this.statusBarManager.updateStatus('refactoring', 'Refactoring Code...');
            const filePath = context.activeEditor.filePath;
            const description = `Refactor ${filePath} to improve readability, maintainability, and performance`;
            const result = await this.swarmManager.executeTask(description, 'refactoring', filePath);
            // Show refactoring suggestions
            await this.showRefactoringResults(result);
            this.statusBarManager.updateStatus('ready', 'Refactoring Complete');
            vscode.window.showInformationMessage('🔧 Code refactoring completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Refactoring Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Code refactoring failed: ${errorMessage}`);
        }
    }
    async monitorSwarm() {
        try {
            const description = 'Monitor swarm performance and agent status';
            await this.swarmManager.executeTask(description, 'analysis');
            vscode.window.showInformationMessage('📊 Swarm monitoring started!');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Monitoring failed: ${errorMessage}`);
        }
    }
    async benchmarkPerformance() {
        try {
            this.statusBarManager.updateStatus('benchmarking', 'Running Benchmarks...');
            const description = 'Run comprehensive performance benchmarks';
            const result = await this.swarmManager.executeTask(description, 'analysis');
            // Show benchmark results
            await this.showBenchmarkResults(result);
            this.statusBarManager.updateStatus('ready', 'Benchmarks Complete');
            vscode.window.showInformationMessage('🏃 Performance benchmarks completed!');
        }
        catch (error) {
            this.statusBarManager.updateStatus('error', 'Benchmarks Failed');
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Benchmarks failed: ${errorMessage}`);
        }
    }
    getCommandContext() {
        const activeEditor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        return {
            workspaceFolder: workspaceFolder?.uri.fsPath,
            activeEditor: activeEditor ? {
                filePath: activeEditor.document.fileName,
                language: activeEditor.document.languageId,
                selection: activeEditor.selection ? {
                    start: {
                        line: activeEditor.selection.start.line,
                        character: activeEditor.selection.start.character
                    },
                    end: {
                        line: activeEditor.selection.end.line,
                        character: activeEditor.selection.end.character
                    }
                } : undefined,
                text: activeEditor.selection ? activeEditor.document.getText(activeEditor.selection) : undefined
            } : undefined,
            config: {
                enabled: config.get('enabled', true),
                autoInitialize: config.get('autoInitialize', true),
                defaultTopology: config.get('defaultTopology', 'hierarchical'),
                maxAgents: config.get('maxAgents', 8),
                cognitivePatterns: config.get('cognitivePatterns', ['convergent', 'divergent', 'systems', 'critical']),
                autoAnalyze: config.get('autoAnalyze', {
                    enabled: true,
                    onSave: true,
                    onOpen: false,
                    debounceMs: 2000
                }),
                fileWatcher: config.get('fileWatcher', {
                    enabled: true,
                    patterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.py', '**/*.rs', '**/*.go', '**/*.java', '**/*.cs'],
                    exclude: ['**/node_modules/**', '**/target/**', '**/build/**', '**/dist/**']
                }),
                terminal: config.get('terminal', {
                    showOutput: true,
                    clearOnRun: false,
                    focusOnRun: true
                })
            }
        };
    }
    async createTestFile(filePath, testContent) {
        const testFilePath = this.getTestFilePath(filePath);
        const testUri = vscode.Uri.file(testFilePath);
        await vscode.workspace.fs.writeFile(testUri, Buffer.from(testContent));
        // Open the test file
        const testDocument = await vscode.workspace.openTextDocument(testUri);
        await vscode.window.showTextDocument(testDocument);
    }
    getTestFilePath(filePath) {
        const ext = filePath.split('.').pop();
        const basePath = filePath.replace(`.${ext}`, '');
        return `${basePath}.test.${ext}`;
    }
    async showCodeReviewResults(result) {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Code Review');
        outputChannel.clear();
        outputChannel.appendLine('👥 RUV-Swarm Code Review Results');
        outputChannel.appendLine('================================');
        outputChannel.appendLine(result);
        outputChannel.show();
    }
    async showOptimizationResults(result) {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Optimization');
        outputChannel.clear();
        outputChannel.appendLine('⚡ Performance Optimization Results');
        outputChannel.appendLine('===================================');
        outputChannel.appendLine(result);
        outputChannel.show();
    }
    async showCodeExplanation(result) {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Code Explanation');
        outputChannel.clear();
        outputChannel.appendLine('📖 Code Explanation');
        outputChannel.appendLine('===================');
        outputChannel.appendLine(result);
        outputChannel.show();
    }
    async showRefactoringResults(result) {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Refactoring');
        outputChannel.clear();
        outputChannel.appendLine('🔧 Refactoring Suggestions');
        outputChannel.appendLine('==========================');
        outputChannel.appendLine(result);
        outputChannel.show();
    }
    async showBenchmarkResults(result) {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Benchmarks');
        outputChannel.clear();
        outputChannel.appendLine('🏃 Performance Benchmarks');
        outputChannel.appendLine('=========================');
        outputChannel.appendLine(result);
        outputChannel.show();
    }
}
exports.CommandManager = CommandManager;
//# sourceMappingURL=commandManager.js.map