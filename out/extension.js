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
exports.webviewProvider = exports.fileWatcher = exports.statusBarManager = exports.diagnosticsProvider = exports.commandManager = exports.swarmManager = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const swarmManager_1 = require("./utils/swarmManager");
const commandManager_1 = require("./commands/commandManager");
const diagnosticsProvider_1 = require("./providers/diagnosticsProvider");
const statusBarManager_1 = require("./utils/statusBarManager");
const fileWatcher_1 = require("./utils/fileWatcher");
const webviewProvider_1 = require("./webview/webviewProvider");
const commandQueue_1 = require("./commands/commandQueue");
const cliValidator_1 = require("./utils/cliValidator");
const progressManager_1 = require("./utils/progressManager");
const errorHandler_1 = require("./utils/errorHandler");
const batchProcessor_1 = require("./commands/batchProcessor");
let swarmManager;
let commandManager;
let diagnosticsProvider;
let statusBarManager;
let fileWatcher;
let webviewProvider;
let commandQueue;
let cliValidator;
let progressManager;
let errorHandler;
let batchProcessor;
async function activate(context) {
    console.log('🧠 RUV-Swarm extension is now active!');
    try {
        // Initialize core managers in dependency order
        errorHandler = new errorHandler_1.ErrorHandler();
        progressManager = new progressManager_1.ProgressManager();
        cliValidator = new cliValidator_1.CLIValidator();
        exports.statusBarManager = statusBarManager = new statusBarManager_1.StatusBarManager();
        exports.swarmManager = swarmManager = new swarmManager_1.SwarmManager(context);
        exports.diagnosticsProvider = diagnosticsProvider = new diagnosticsProvider_1.DiagnosticsProvider();
        // Initialize command queue and batch processor
        commandQueue = new commandQueue_1.CommandQueue(swarmManager, statusBarManager);
        batchProcessor = new batchProcessor_1.BatchProcessor(swarmManager, progressManager, errorHandler, commandQueue);
        // Initialize command manager with enhanced capabilities
        exports.commandManager = commandManager = new commandManager_1.CommandManager(swarmManager, diagnosticsProvider, statusBarManager);
        exports.fileWatcher = fileWatcher = new fileWatcher_1.FileWatcher(swarmManager, diagnosticsProvider);
        exports.webviewProvider = webviewProvider = new webviewProvider_1.WebviewProvider(context, swarmManager);
        // Add all managers to context subscriptions for proper cleanup
        context.subscriptions.push(errorHandler, progressManager, cliValidator, statusBarManager, swarmManager, diagnosticsProvider, commandQueue, batchProcessor, fileWatcher, webviewProvider);
        // Validate CLI environment
        try {
            const validationResult = await cliValidator.validateCLI();
            if (!validationResult.isAvailable) {
                vscode.window.showWarningMessage('RUV-Swarm CLI not found. Some features may not work properly.', 'Install CLI', 'Learn More').then(choice => {
                    if (choice === 'Install CLI') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ruvnet/ruv-FANN#installation'));
                    }
                    else if (choice === 'Learn More') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ruvnet/ruv-FANN/blob/main/vscode_extension/README.md'));
                    }
                });
            }
        }
        catch (error) {
            console.warn('CLI validation failed:', error);
        }
        // Register all commands
        registerCommands(context);
        // Register providers
        registerProviders(context);
        // Initialize file watcher
        await fileWatcher.initialize();
        // Auto-initialize swarm if configured
        const config = getExtensionConfig();
        if (config.autoInitialize && vscode.workspace.workspaceFolders) {
            await initializeSwarmWithDelay();
        }
        // Set context for when extension is enabled
        vscode.commands.executeCommand('setContext', 'ruv-swarm.enabled', true);
        vscode.window.showInformationMessage('🧠 RUV-Swarm AI Assistant is ready!');
    }
    catch (error) {
        console.error('Failed to activate RUV-Swarm extension:', error);
        // Use error handler if available
        if (errorHandler) {
            await errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), { operation: 'extension_activation', component: 'Extension' });
        }
        else {
            vscode.window.showErrorMessage(`Failed to activate RUV-Swarm: ${error}`);
        }
    }
}
function deactivate() {
    console.log('🧠 RUV-Swarm extension is deactivating...');
    // Cleanup resources
    if (swarmManager) {
        swarmManager.dispose();
    }
    if (fileWatcher) {
        fileWatcher.dispose();
    }
    if (statusBarManager) {
        statusBarManager.dispose();
    }
    if (webviewProvider) {
        webviewProvider.dispose();
    }
}
function registerCommands(context) {
    const commands = [
        // Core swarm commands
        vscode.commands.registerCommand('ruv-swarm.initializeSwarm', () => commandManager.initializeSwarm()),
        vscode.commands.registerCommand('ruv-swarm.spawnCodingAgent', () => commandManager.spawnCodingAgent()),
        // Analysis commands
        vscode.commands.registerCommand('ruv-swarm.analyzeCurrentFile', () => commandManager.analyzeCurrentFile()),
        vscode.commands.registerCommand('ruv-swarm.generateTests', () => commandManager.generateTests()),
        vscode.commands.registerCommand('ruv-swarm.codeReview', () => commandManager.codeReview()),
        vscode.commands.registerCommand('ruv-swarm.optimizePerformance', () => commandManager.optimizePerformance()),
        vscode.commands.registerCommand('ruv-swarm.securityAnalysis', () => commandManager.securityAnalysis()),
        vscode.commands.registerCommand('ruv-swarm.explainCode', () => commandManager.explainCode()),
        vscode.commands.registerCommand('ruv-swarm.refactorCode', () => commandManager.refactorCode()),
        // Monitoring commands
        vscode.commands.registerCommand('ruv-swarm.monitorSwarm', () => commandManager.monitorSwarm()),
        vscode.commands.registerCommand('ruv-swarm.benchmarkPerformance', () => commandManager.benchmarkPerformance()),
        // Dashboard command
        vscode.commands.registerCommand('ruv-swarm.openDashboard', () => webviewProvider.showDashboard()),
        // New Phase 2 commands
        vscode.commands.registerCommand('ruv-swarm.validateCLI', async () => {
            try {
                const result = await cliValidator.validateCLI();
                const message = result.isAvailable
                    ? `✅ CLI is available (v${result.version}). Capabilities: ${result.capabilities.join(', ')}`
                    : `❌ CLI not available. Issues: ${result.errors.join(', ')}`;
                vscode.window.showInformationMessage(message);
            }
            catch (error) {
                vscode.window.showErrorMessage(`CLI validation failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.clearCache', () => {
            cliValidator.clearCache();
            vscode.window.showInformationMessage('🗑️ Cache cleared successfully');
        }),
        vscode.commands.registerCommand('ruv-swarm.showErrorReports', () => {
            const reports = errorHandler.getErrorReports();
            if (reports.length === 0) {
                vscode.window.showInformationMessage('No error reports found');
                return;
            }
            const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Error Reports');
            outputChannel.clear();
            outputChannel.appendLine('RUV-Swarm Error Reports');
            outputChannel.appendLine('========================\n');
            reports.forEach((report, index) => {
                outputChannel.appendLine(`${index + 1}. [${report.severity.toUpperCase()}] ${report.error.message}`);
                outputChannel.appendLine(`   Time: ${report.timestamp.toISOString()}`);
                outputChannel.appendLine(`   Category: ${report.category}`);
                outputChannel.appendLine(`   Handled: ${report.handled}`);
                outputChannel.appendLine('');
            });
            outputChannel.show();
        }),
        vscode.commands.registerCommand('ruv-swarm.batchAnalyzeWorkspace', async () => {
            try {
                const batchId = await batchProcessor.createWorkspaceBatch('analyze', {
                    parallel: true,
                    maxConcurrency: 3,
                    continueOnError: true
                });
                vscode.window.showInformationMessage(`Started batch analysis: ${batchId}`);
                await batchProcessor.executeBatch(batchId);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Batch analysis failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.batchGenerateTests', async () => {
            try {
                const batchId = await batchProcessor.createWorkspaceBatch('test', {
                    parallel: true,
                    maxConcurrency: 2,
                    continueOnError: true
                });
                vscode.window.showInformationMessage(`Started batch test generation: ${batchId}`);
                await batchProcessor.executeBatch(batchId);
            }
            catch (error) {
                vscode.window.showErrorMessage(`Batch test generation failed: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.showCommandQueue', () => {
            const status = commandQueue.getQueueStatus();
            const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Command Queue');
            outputChannel.clear();
            outputChannel.appendLine('RUV-Swarm Command Queue Status');
            outputChannel.appendLine('===============================\n');
            outputChannel.appendLine(`Pending: ${status.pending}`);
            outputChannel.appendLine(`Running: ${status.running}`);
            outputChannel.appendLine(`Total: ${status.total}\n`);
            if (status.commands.length > 0) {
                outputChannel.appendLine('Commands:');
                status.commands.forEach((cmd, index) => {
                    outputChannel.appendLine(`${index + 1}. [${cmd.status.toUpperCase()}] ${cmd.command}`);
                    outputChannel.appendLine(`   Priority: ${cmd.priority}`);
                    outputChannel.appendLine(`   Created: ${cmd.createdAt.toISOString()}`);
                    if (cmd.error) {
                        outputChannel.appendLine(`   Error: ${cmd.error}`);
                    }
                    outputChannel.appendLine('');
                });
            }
            outputChannel.show();
        }),
        vscode.commands.registerCommand('ruv-swarm.pauseQueue', async () => {
            await commandQueue.pauseProcessing();
            vscode.window.showInformationMessage('⏸️ Command queue paused');
        }),
        vscode.commands.registerCommand('ruv-swarm.resumeQueue', async () => {
            await commandQueue.resumeProcessing();
            vscode.window.showInformationMessage('▶️ Command queue resumed');
        }),
        vscode.commands.registerCommand('ruv-swarm.clearQueue', async () => {
            await commandQueue.clearQueue();
            vscode.window.showInformationMessage('🗑️ Command queue cleared');
        }),
    ];
    // Add all commands to context subscriptions
    commands.forEach(command => context.subscriptions.push(command));
}
function registerProviders(context) {
    // Register diagnostics provider
    context.subscriptions.push(diagnosticsProvider);
    // Register webview provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('ruv-swarm.dashboard', webviewProvider));
    // Register document save listener
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        const config = getExtensionConfig();
        if (config.autoAnalyze.enabled && config.autoAnalyze.onSave) {
            await fileWatcher.handleFileChange(document.uri);
        }
    }));
    // Register document open listener
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(async (document) => {
        const config = getExtensionConfig();
        if (config.autoAnalyze.enabled && config.autoAnalyze.onOpen) {
            await fileWatcher.handleFileChange(document.uri);
        }
    }));
    // Register configuration change listener
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('ruv-swarm')) {
            handleConfigurationChange();
        }
    }));
}
async function initializeSwarmWithDelay() {
    // Add a small delay to ensure workspace is fully loaded
    setTimeout(async () => {
        try {
            await swarmManager.initializeSwarm();
            statusBarManager.updateStatus('ready', 'RUV-Swarm Ready');
        }
        catch (error) {
            console.error('Auto-initialization failed:', error);
            statusBarManager.updateStatus('error', 'RUV-Swarm Error');
        }
    }, 2000);
}
function handleConfigurationChange() {
    const config = getExtensionConfig();
    // Update file watcher patterns
    if (fileWatcher) {
        fileWatcher.updateConfiguration(config.fileWatcher);
    }
    // Update swarm configuration
    if (swarmManager) {
        swarmManager.updateConfiguration({
            topology: config.defaultTopology,
            maxAgents: config.maxAgents,
            cognitivePatterns: config.cognitivePatterns,
            enableMLOptimization: true,
            enableWASM: true,
            enableSIMD: true
        });
    }
}
function getExtensionConfig() {
    const config = vscode.workspace.getConfiguration('ruv-swarm');
    return {
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
    };
}
//# sourceMappingURL=extension.js.map