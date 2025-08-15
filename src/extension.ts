import * as vscode from 'vscode';
import { SwarmManager } from './utils/swarmManager';
import { CommandManager } from './commands/commandManager';
import { DiagnosticsProvider } from './providers/diagnosticsProvider';
import { StatusBarManager } from './utils/statusBarManager';
import { FileWatcher } from './utils/fileWatcher';
import { WebviewProvider } from './webview/webviewProvider';
import { EnhancedDashboard } from './webview/enhancedDashboard';
import { CommandQueue } from './commands/commandQueue';
import { CLIValidator } from './utils/cliValidator';
import { ProgressManager } from './utils/progressManager';
import { ErrorHandler } from './utils/errorHandler';
import { BatchProcessor } from './commands/batchProcessor';
import { ExtensionConfig } from './types';

let swarmManager: SwarmManager;
let commandManager: CommandManager;
let diagnosticsProvider: DiagnosticsProvider;
let statusBarManager: StatusBarManager;
let fileWatcher: FileWatcher;
let webviewProvider: WebviewProvider;
let enhancedDashboard: EnhancedDashboard;
let commandQueue: CommandQueue;
let cliValidator: CLIValidator;
let progressManager: ProgressManager;
let errorHandler: ErrorHandler;
let batchProcessor: BatchProcessor;

export async function activate(context: vscode.ExtensionContext) {
    console.log('🧠 RUV-Swarm extension is now active!');
    console.log('📊 DEBUG: Extension activation started at:', new Date().toISOString());
    console.log('📊 DEBUG: VSCode version:', vscode.version);
    console.log('📊 DEBUG: Extension context globalState keys:', context.globalState.keys());

    try {
        // Initialize core managers in dependency order
        console.log('📊 DEBUG: Initializing ErrorHandler...');
        errorHandler = new ErrorHandler();
        
        console.log('📊 DEBUG: Initializing ProgressManager...');
        progressManager = new ProgressManager();
        
        console.log('📊 DEBUG: Initializing CLIValidator...');
        cliValidator = new CLIValidator();
        
        console.log('📊 DEBUG: Initializing StatusBarManager...');
        statusBarManager = new StatusBarManager();
        
        console.log('📊 DEBUG: Initializing SwarmManager...');
        swarmManager = new SwarmManager(context);
        
        console.log('📊 DEBUG: Initializing DiagnosticsProvider...');
        diagnosticsProvider = new DiagnosticsProvider();
        
        // Initialize command queue and batch processor
        console.log('📊 DEBUG: Initializing CommandQueue...');
        commandQueue = new CommandQueue(swarmManager, statusBarManager);
        
        console.log('📊 DEBUG: Initializing BatchProcessor...');
        batchProcessor = new BatchProcessor(swarmManager, progressManager, errorHandler, commandQueue);
        
        // Initialize command manager with enhanced capabilities
        console.log('📊 DEBUG: Initializing CommandManager...');
        commandManager = new CommandManager(swarmManager, diagnosticsProvider, statusBarManager);
        
        console.log('📊 DEBUG: Initializing FileWatcher...');
        fileWatcher = new FileWatcher(swarmManager, diagnosticsProvider);
        
        console.log('📊 DEBUG: Initializing WebviewProvider...');
        webviewProvider = new WebviewProvider(context, swarmManager);
        
        console.log('📊 DEBUG: Initializing EnhancedDashboard...');
        enhancedDashboard = new EnhancedDashboard(context, swarmManager, commandManager);

        // Add all managers to context subscriptions for proper cleanup
        context.subscriptions.push(
            errorHandler,
            progressManager,
            cliValidator,
            statusBarManager,
            swarmManager,
            diagnosticsProvider,
            commandQueue,
            batchProcessor,
            fileWatcher,
            webviewProvider,
            enhancedDashboard
        );

        // Validate CLI environment
        console.log('📊 DEBUG: Starting CLI validation...');
        try {
            const validationResult = await cliValidator.validateCLI();
            console.log('📊 DEBUG: CLI validation result:', validationResult);
            
            if (!validationResult.isAvailable) {
                console.log('📊 DEBUG: CLI not available, showing warning message');
                vscode.window.showWarningMessage(
                    'RUV-Swarm CLI not found. Some features may not work properly.',
                    'Install CLI',
                    'Learn More'
                ).then(choice => {
                    console.log('📊 DEBUG: User selected CLI warning option:', choice);
                    if (choice === 'Install CLI') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ruvnet/ruv-FANN#installation'));
                    } else if (choice === 'Learn More') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ruvnet/ruv-FANN/blob/main/vscode_extension/README.md'));
                    }
                });
            } else {
                console.log('📊 DEBUG: CLI validation successful');
            }
        } catch (error) {
            console.warn('📊 DEBUG: CLI validation failed:', error);
        }

        // Register all commands
        console.log('📊 DEBUG: Registering commands...');
        registerCommands(context);

        // Register providers
        console.log('📊 DEBUG: Registering providers...');
        registerProviders(context);

        // Initialize file watcher
        console.log('📊 DEBUG: Initializing file watcher...');
        await fileWatcher.initialize();

        // Auto-initialize swarm if configured
        const config = getExtensionConfig();
        console.log('📊 DEBUG: Extension configuration:', config);
        
        if (config.autoInitialize && vscode.workspace.workspaceFolders) {
            console.log('📊 DEBUG: Auto-initializing swarm...');
            await initializeSwarmWithDelay();
        } else {
            console.log('📊 DEBUG: Skipping auto-initialization - autoInitialize:', config.autoInitialize, 'workspaceFolders:', !!vscode.workspace.workspaceFolders);
        }

        // Set context for when extension is enabled
        console.log('📊 DEBUG: Setting extension context...');
        vscode.commands.executeCommand('setContext', 'ruv-swarm.enabled', true);

        console.log('📊 DEBUG: Extension activation completed successfully');
        vscode.window.showInformationMessage('🧠 RUV-Swarm AI Assistant is ready!');

    } catch (error) {
        console.error('Failed to activate RUV-Swarm extension:', error);
        
        // Use error handler if available
        if (errorHandler) {
            await errorHandler.handleError(
                error instanceof Error ? error : new Error(String(error)),
                { operation: 'extension_activation', component: 'Extension' }
            );
        } else {
            vscode.window.showErrorMessage(`Failed to activate RUV-Swarm: ${error}`);
        }
    }
}

export function deactivate() {
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

function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        // Core swarm commands
        vscode.commands.registerCommand('ruv-swarm.initializeSwarm', () => {
            console.log('🎯 DEBUG: User executed command: initializeSwarm');
            return commandManager.initializeSwarm();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.spawnCodingAgent', () => {
            console.log('🎯 DEBUG: User executed command: spawnCodingAgent');
            return commandManager.spawnCodingAgent();
        }),
        
        // Analysis commands
        vscode.commands.registerCommand('ruv-swarm.analyzeCurrentFile', () => {
            console.log('🎯 DEBUG: User executed command: analyzeCurrentFile');
            const activeEditor = vscode.window.activeTextEditor;
            console.log('🎯 DEBUG: Active editor file:', activeEditor?.document.fileName);
            return commandManager.analyzeCurrentFile();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.generateTests', () => {
            console.log('🎯 DEBUG: User executed command: generateTests');
            return commandManager.generateTests();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.codeReview', () => {
            console.log('🎯 DEBUG: User executed command: codeReview');
            return commandManager.codeReview();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.optimizePerformance', () => {
            console.log('🎯 DEBUG: User executed command: optimizePerformance');
            return commandManager.optimizePerformance();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.securityAnalysis', () => {
            console.log('🎯 DEBUG: User executed command: securityAnalysis');
            return commandManager.securityAnalysis();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.explainCode', () => {
            console.log('🎯 DEBUG: User executed command: explainCode');
            const selection = vscode.window.activeTextEditor?.selection;
            console.log('🎯 DEBUG: Selected text range:', selection);
            return commandManager.explainCode();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.refactorCode', () => {
            console.log('🎯 DEBUG: User executed command: refactorCode');
            return commandManager.refactorCode();
        }),
        
        // Monitoring commands
        vscode.commands.registerCommand('ruv-swarm.monitorSwarm', () => {
            console.log('🎯 DEBUG: User executed command: monitorSwarm');
            return commandManager.monitorSwarm();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.benchmarkPerformance', () => {
            console.log('🎯 DEBUG: User executed command: benchmarkPerformance');
            return commandManager.benchmarkPerformance();
        }),
        
        // Dashboard commands
        vscode.commands.registerCommand('ruv-swarm.openDashboard', () => {
            console.log('🎯 DEBUG: User executed command: openDashboard (enhanced)');
            return enhancedDashboard.showDashboard();
        }),
        
        vscode.commands.registerCommand('ruv-swarm.openBasicDashboard', () => {
            console.log('🎯 DEBUG: User executed command: openBasicDashboard');
            return webviewProvider.showDashboard();
        }),
        
        // New Phase 2 commands
        vscode.commands.registerCommand('ruv-swarm.validateCLI', async () => {
            console.log('🎯 DEBUG: User executed command: validateCLI');
            try {
                const result = await cliValidator.validateCLI();
                console.log('🎯 DEBUG: CLI validation result:', result);
                const message = result.isAvailable 
                    ? `✅ CLI is available (v${result.version}). Capabilities: ${result.capabilities.join(', ')}`
                    : `❌ CLI not available. Issues: ${result.errors.join(', ')}`;
                
                vscode.window.showInformationMessage(message);
            } catch (error) {
                console.log('🎯 DEBUG: CLI validation error:', error);
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
            } catch (error) {
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
            } catch (error) {
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

function registerProviders(context: vscode.ExtensionContext) {
    // Register diagnostics provider
    context.subscriptions.push(diagnosticsProvider);

    // Register webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'ruv-swarm.dashboard',
            webviewProvider
        )
    );

    // Register document save listener
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            const config = getExtensionConfig();
            if (config.autoAnalyze.enabled && config.autoAnalyze.onSave) {
                await fileWatcher.handleFileChange(document.uri);
            }
        })
    );

    // Register document open listener
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(async (document) => {
            const config = getExtensionConfig();
            if (config.autoAnalyze.enabled && config.autoAnalyze.onOpen) {
                await fileWatcher.handleFileChange(document.uri);
            }
        })
    );

    // Register configuration change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('ruv-swarm')) {
                handleConfigurationChange();
            }
        })
    );
}

async function initializeSwarmWithDelay() {
    // Add a small delay to ensure workspace is fully loaded
    setTimeout(async () => {
        try {
            await swarmManager.initializeSwarm();
            statusBarManager.updateStatus('ready', 'RUV-Swarm Ready');
        } catch (error) {
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
            topology: config.defaultTopology as any,
            maxAgents: config.maxAgents,
            cognitivePatterns: config.cognitivePatterns as any[],
            enableMLOptimization: true,
            enableWASM: true,
            enableSIMD: true
        });
    }
}

function getExtensionConfig(): ExtensionConfig {
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

// Export managers for testing
export {
    swarmManager,
    commandManager,
    diagnosticsProvider,
    statusBarManager,
    fileWatcher,
    webviewProvider
};
