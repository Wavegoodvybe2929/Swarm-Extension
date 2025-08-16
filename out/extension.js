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
const hiveOrchestrator_1 = require("./hive/hiveOrchestrator");
const specificationGenerator_1 = require("./specs/specificationGenerator");
const commandManager_1 = require("./commands/commandManager");
const diagnosticsProvider_1 = require("./providers/diagnosticsProvider");
const statusBarManager_1 = require("./utils/statusBarManager");
const fileWatcher_1 = require("./utils/fileWatcher");
const webviewProvider_1 = require("./webview/webviewProvider");
const enhancedDashboard_1 = require("./webview/enhancedDashboard");
const commandQueue_1 = require("./commands/commandQueue");
const cliValidator_1 = require("./utils/cliValidator");
const progressManager_1 = require("./utils/progressManager");
const errorHandler_1 = require("./utils/errorHandler");
const batchProcessor_1 = require("./commands/batchProcessor");
const lmStudioServer_1 = require("./mcp/servers/lmStudioServer");
const lmStudioChat_1 = require("./webview/lmStudioChat");
const chatViewProvider_1 = require("./webview/chatViewProvider");
const settingsManager_1 = require("./settings/settingsManager");
const profileManager_1 = require("./settings/profileManager");
const validationEngine_1 = require("./settings/validationEngine");
const swarmStatusProvider_1 = require("./providers/swarmStatusProvider");
const activeAgentsProvider_1 = require("./providers/activeAgentsProvider");
const recentAnalysisProvider_1 = require("./providers/recentAnalysisProvider");
let swarmManager;
let hiveOrchestrator;
let specificationGenerator;
let commandManager;
let diagnosticsProvider;
let statusBarManager;
let fileWatcher;
let webviewProvider;
let enhancedDashboard;
let commandQueue;
let cliValidator;
let progressManager;
let errorHandler;
let batchProcessor;
let lmStudioServer;
let lmStudioChat;
let chatViewProvider;
let settingsManager;
let profileManager;
let validationEngine;
let swarmStatusProvider;
let activeAgentsProvider;
let recentAnalysisProvider;
async function activate(context) {
    console.log('🧠 RUV-Swarm extension is now active!');
    console.log('📊 DEBUG: Extension activation started at:', new Date().toISOString());
    console.log('📊 DEBUG: VSCode version:', vscode.version);
    console.log('📊 DEBUG: Extension context globalState keys:', context.globalState.keys());
    try {
        // Initialize core managers in dependency order
        console.log('📊 DEBUG: Initializing ErrorHandler...');
        errorHandler = new errorHandler_1.ErrorHandler();
        console.log('📊 DEBUG: Initializing ProgressManager...');
        progressManager = new progressManager_1.ProgressManager();
        console.log('📊 DEBUG: Initializing CLIValidator...');
        cliValidator = new cliValidator_1.CLIValidator();
        console.log('📊 DEBUG: Initializing StatusBarManager...');
        exports.statusBarManager = statusBarManager = new statusBarManager_1.StatusBarManager();
        console.log('📊 DEBUG: Initializing SwarmManager...');
        exports.swarmManager = swarmManager = new swarmManager_1.SwarmManager(context);
        console.log('📊 DEBUG: Initializing DiagnosticsProvider...');
        exports.diagnosticsProvider = diagnosticsProvider = new diagnosticsProvider_1.DiagnosticsProvider();
        // Initialize command queue and batch processor
        console.log('📊 DEBUG: Initializing CommandQueue...');
        commandQueue = new commandQueue_1.CommandQueue(swarmManager, statusBarManager);
        console.log('📊 DEBUG: Initializing BatchProcessor...');
        batchProcessor = new batchProcessor_1.BatchProcessor(swarmManager, progressManager, errorHandler, commandQueue);
        // Initialize command manager with enhanced capabilities
        console.log('📊 DEBUG: Initializing CommandManager...');
        exports.commandManager = commandManager = new commandManager_1.CommandManager(swarmManager, diagnosticsProvider, statusBarManager);
        console.log('📊 DEBUG: Initializing FileWatcher...');
        exports.fileWatcher = fileWatcher = new fileWatcher_1.FileWatcher(swarmManager, diagnosticsProvider);
        console.log('📊 DEBUG: Initializing WebviewProvider...');
        exports.webviewProvider = webviewProvider = new webviewProvider_1.WebviewProvider(context, swarmManager);
        console.log('📊 DEBUG: Initializing EnhancedDashboard...');
        enhancedDashboard = new enhancedDashboard_1.EnhancedDashboard(context, swarmManager, commandManager);
        // Initialize settings components
        console.log('📊 DEBUG: Initializing ValidationEngine...');
        validationEngine = new validationEngine_1.ValidationEngine();
        console.log('📊 DEBUG: Initializing ProfileManager...');
        profileManager = new profileManager_1.ProfileManager(context);
        console.log('📊 DEBUG: Initializing SettingsManager...');
        settingsManager = new settingsManager_1.SettingsManager(context, profileManager, validationEngine, errorHandler);
        await settingsManager.initialize();
        // Initialize LM Studio components
        console.log('📊 DEBUG: Initializing LMStudioServer...');
        lmStudioServer = new lmStudioServer_1.LMStudioServer(context, swarmManager);
        console.log('📊 DEBUG: Initializing LMStudioChat...');
        lmStudioChat = new lmStudioChat_1.LMStudioChat(context, lmStudioServer, swarmManager);
        console.log('📊 DEBUG: Initializing ChatViewProvider...');
        chatViewProvider = new chatViewProvider_1.ChatViewProvider(context, lmStudioServer, swarmManager);
        // Initialize Hive Mind components
        console.log('📊 DEBUG: Initializing HiveOrchestrator...');
        hiveOrchestrator = new hiveOrchestrator_1.HiveOrchestrator(context);
        console.log('📊 DEBUG: Initializing SpecificationGenerator...');
        specificationGenerator = new specificationGenerator_1.SpecificationGenerator(lmStudioServer);
        // Initialize tree data providers
        console.log('📊 DEBUG: Initializing SwarmStatusProvider...');
        swarmStatusProvider = new swarmStatusProvider_1.SwarmStatusProvider(swarmManager);
        console.log('📊 DEBUG: Initializing ActiveAgentsProvider...');
        activeAgentsProvider = new activeAgentsProvider_1.ActiveAgentsProvider(swarmManager);
        console.log('📊 DEBUG: Initializing RecentAnalysisProvider...');
        recentAnalysisProvider = new recentAnalysisProvider_1.RecentAnalysisProvider(swarmManager);
        // Auto-connect to LM Studio if configured
        const lmStudioConfig = await settingsManager.getSetting('lmstudio.enabled', true);
        const autoConnect = await settingsManager.getSetting('lmstudio.connection.autoConnect', true);
        if (lmStudioConfig && autoConnect) {
            console.log('📊 DEBUG: Auto-connecting to LM Studio...');
            try {
                await lmStudioServer.connect();
                console.log('📊 DEBUG: LM Studio connected successfully');
                vscode.window.showInformationMessage('🤖 LM Studio connected successfully!');
            }
            catch (error) {
                console.log('📊 DEBUG: LM Studio auto-connect failed:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Show a more helpful error message
                if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
                    vscode.window.showWarningMessage('🤖 LM Studio is not running. Please start LM Studio and load a model to use AI features.', 'Open LM Studio Settings', 'Try Connect Again').then(choice => {
                        if (choice === 'Open LM Studio Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'ruv-swarm.lmstudio');
                        }
                        else if (choice === 'Try Connect Again') {
                            vscode.commands.executeCommand('ruv-swarm.connectLMStudio');
                        }
                    });
                }
                else {
                    vscode.window.showErrorMessage(`🤖 Failed to connect to LM Studio: ${errorMessage}`, 'Check Settings', 'View Logs').then(choice => {
                        if (choice === 'Check Settings') {
                            vscode.commands.executeCommand('workbench.action.openSettings', 'ruv-swarm.lmstudio');
                        }
                        else if (choice === 'View Logs') {
                            vscode.commands.executeCommand('workbench.action.toggleDevTools');
                        }
                    });
                }
            }
        }
        // Add all managers to context subscriptions for proper cleanup
        context.subscriptions.push(errorHandler, progressManager, cliValidator, statusBarManager, swarmManager, diagnosticsProvider, commandQueue, batchProcessor, fileWatcher, webviewProvider, enhancedDashboard, settingsManager, profileManager, validationEngine, lmStudioServer, lmStudioChat, chatViewProvider);
        // Validate CLI environment
        console.log('📊 DEBUG: Starting CLI validation...');
        try {
            const validationResult = await cliValidator.validateCLI();
            console.log('📊 DEBUG: CLI validation result:', validationResult);
            if (!validationResult.isAvailable) {
                console.log('📊 DEBUG: CLI not available, showing warning message');
                vscode.window.showWarningMessage('RUV-Swarm CLI not found. Some features may not work properly.', 'Install CLI', 'Learn More').then(choice => {
                    console.log('📊 DEBUG: User selected CLI warning option:', choice);
                    if (choice === 'Install CLI') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ruvnet/ruv-FANN#installation'));
                    }
                    else if (choice === 'Learn More') {
                        vscode.env.openExternal(vscode.Uri.parse('https://github.com/ruvnet/ruv-FANN/blob/main/vscode_extension/README.md'));
                    }
                });
            }
            else {
                console.log('📊 DEBUG: CLI validation successful');
            }
        }
        catch (error) {
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
        }
        else {
            console.log('📊 DEBUG: Skipping auto-initialization - autoInitialize:', config.autoInitialize, 'workspaceFolders:', !!vscode.workspace.workspaceFolders);
        }
        // Set context for when extension is enabled
        console.log('📊 DEBUG: Setting extension context...');
        vscode.commands.executeCommand('setContext', 'ruv-swarm.enabled', true);
        console.log('📊 DEBUG: Extension activation completed successfully');
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
            }
            catch (error) {
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
        // LM Studio commands
        vscode.commands.registerCommand('ruv-swarm.openLMStudioChat', () => {
            console.log('🎯 DEBUG: User executed command: openLMStudioChat');
            return lmStudioChat.showChat();
        }),
        vscode.commands.registerCommand('ruv-swarm.connectLMStudio', async () => {
            console.log('🎯 DEBUG: User executed command: connectLMStudio');
            try {
                await lmStudioServer.connect();
                vscode.window.showInformationMessage('✅ Connected to LM Studio successfully!');
            }
            catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to connect to LM Studio: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.disconnectLMStudio', async () => {
            console.log('🎯 DEBUG: User executed command: disconnectLMStudio');
            try {
                await lmStudioServer.disconnect();
                vscode.window.showInformationMessage('🔌 Disconnected from LM Studio');
            }
            catch (error) {
                vscode.window.showErrorMessage(`❌ Failed to disconnect from LM Studio: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.checkLMStudioConnection', async () => {
            console.log('🎯 DEBUG: User executed command: checkLMStudioConnection');
            const isConnected = lmStudioServer.isConnected;
            const message = isConnected
                ? '✅ LM Studio is connected and ready!'
                : '❌ LM Studio is not connected. Use "Connect to LM Studio" command to establish connection.';
            if (isConnected) {
                vscode.window.showInformationMessage(message);
            }
            else {
                vscode.window.showWarningMessage(message, 'Connect Now').then(choice => {
                    if (choice === 'Connect Now') {
                        vscode.commands.executeCommand('ruv-swarm.connectLMStudio');
                    }
                });
            }
        }),
        // Settings commands
        vscode.commands.registerCommand('ruv-swarm.openSettings', () => {
            console.log('🎯 DEBUG: User executed command: openSettings');
            return settingsManager.showSettingsUI();
        }),
        vscode.commands.registerCommand('ruv-swarm.exportSettings', async () => {
            console.log('🎯 DEBUG: User executed command: exportSettings');
            try {
                const settings = await settingsManager.exportSettings();
                const uri = await vscode.window.showSaveDialog({
                    defaultUri: vscode.Uri.file(`ruv-swarm-settings-${Date.now()}.json`),
                    filters: {
                        'JSON Files': ['json'],
                        'All Files': ['*']
                    }
                });
                if (uri) {
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(settings, 'utf8'));
                    vscode.window.showInformationMessage('⚙️ Settings exported successfully!');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.importSettings', async () => {
            console.log('🎯 DEBUG: User executed command: importSettings');
            try {
                const uris = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'JSON Files': ['json'],
                        'All Files': ['*']
                    }
                });
                if (uris && uris[0]) {
                    const content = await vscode.workspace.fs.readFile(uris[0]);
                    const settingsJson = Buffer.from(content).toString('utf8');
                    await settingsManager.importSettings(settingsJson);
                    vscode.window.showInformationMessage('⚙️ Settings imported successfully!');
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to import settings: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.resetSettings', async () => {
            console.log('🎯 DEBUG: User executed command: resetSettings');
            const choice = await vscode.window.showWarningMessage('Are you sure you want to reset all settings to defaults? This action cannot be undone.', 'Reset All Settings', 'Cancel');
            if (choice === 'Reset All Settings') {
                try {
                    await settingsManager.resetAllSettings();
                    vscode.window.showInformationMessage('🔄 All settings have been reset to defaults');
                }
                catch (error) {
                    vscode.window.showErrorMessage(`Failed to reset settings: ${error}`);
                }
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.optimizeSettings', async () => {
            console.log('🎯 DEBUG: User executed command: optimizeSettings');
            try {
                await settingsManager.optimizeSettings();
                vscode.window.showInformationMessage('🔧 Settings optimized for your system!');
            }
            catch (error) {
                vscode.window.showErrorMessage(`Failed to optimize settings: ${error}`);
            }
        }),
        // Hive Mind commands
        vscode.commands.registerCommand('ruv-swarm.initializeHive', async () => {
            console.log('🎯 DEBUG: User executed command: initializeHive');
            try {
                const config = {
                    maxAgents: 10,
                    memoryBankSize: '1GB',
                    orchestrationMode: 'adaptive',
                    topology: 'mesh',
                    autoScale: true,
                    minAgents: 2,
                    maxConcurrentTasks: 5
                };
                await hiveOrchestrator.initializeHive(config);
                vscode.window.showInformationMessage('🧠 Hive Mind initialized successfully!');
            }
            catch (error) {
                console.error('🎯 DEBUG: Hive initialization error:', error);
                vscode.window.showErrorMessage(`Failed to initialize Hive Mind: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.generateSpecification', async () => {
            console.log('🎯 DEBUG: User executed command: generateSpecification');
            try {
                const userInput = await vscode.window.showInputBox({
                    prompt: 'Describe what you want to build',
                    placeHolder: 'e.g., Create a user authentication system with JWT tokens',
                    ignoreFocusOut: true
                });
                if (!userInput) {
                    return;
                }
                vscode.window.showInformationMessage('🔄 Generating specification...');
                const request = {
                    userRequest: userInput,
                    context: {
                        workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                        activeFile: vscode.window.activeTextEditor?.document.fileName,
                        projectType: 'general'
                    },
                    preferences: {
                        complexity: 'moderate',
                        timeline: 'normal',
                        quality: 'production'
                    }
                };
                const specification = await specificationGenerator.generateSpecification(request);
                // Convert specification to markdown content
                const markdownContent = convertSpecToMarkdown(specification);
                // Show the generated specification
                const doc = await vscode.workspace.openTextDocument({
                    content: markdownContent,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage('📋 Specification generated successfully!');
            }
            catch (error) {
                console.error('🎯 DEBUG: Specification generation error:', error);
                vscode.window.showErrorMessage(`Failed to generate specification: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.orchestrateSpecification', async () => {
            console.log('🎯 DEBUG: User executed command: orchestrateSpecification');
            try {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    vscode.window.showErrorMessage('Please open a specification file first');
                    return;
                }
                const specContent = activeEditor.document.getText();
                if (!specContent.trim()) {
                    vscode.window.showErrorMessage('Specification file is empty');
                    return;
                }
                vscode.window.showInformationMessage('🚀 Starting hive mind orchestration...');
                // Parse the specification content
                const specification = {
                    id: `spec-${Date.now()}`,
                    title: 'User Specification',
                    description: 'Generated from user input',
                    requirements: [],
                    architecture: [],
                    tasks: [],
                    acceptanceCriteria: [],
                    priority: 'medium',
                    estimatedDuration: 1,
                    dependencies: []
                };
                const result = await hiveOrchestrator.orchestrateSpecification(specification);
                // Show results
                const outputChannel = vscode.window.createOutputChannel('Hive Mind Orchestration');
                outputChannel.clear();
                outputChannel.appendLine('Hive Mind Orchestration Results');
                outputChannel.appendLine('================================\n');
                outputChannel.appendLine(`Specification: ${specification.title}`);
                outputChannel.appendLine(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
                outputChannel.appendLine(`Agents Used: ${result.agentsUsed.join(', ')}`);
                outputChannel.appendLine(`Execution Time: ${result.executionTime}ms\n`);
                if (result.results && result.results.length > 0) {
                    outputChannel.appendLine('Results:');
                    result.results.forEach((res, index) => {
                        outputChannel.appendLine(`${index + 1}. ${res.agentType}: ${res.success ? 'SUCCESS' : 'FAILED'}`);
                        if (res.output) {
                            outputChannel.appendLine(`   Output: ${res.output}`);
                        }
                        if (res.error) {
                            outputChannel.appendLine(`   Error: ${res.error}`);
                        }
                    });
                }
                outputChannel.show();
                if (result.success) {
                    vscode.window.showInformationMessage('✅ Hive mind orchestration completed successfully!');
                }
                else {
                    vscode.window.showWarningMessage('⚠️ Hive mind orchestration completed with issues. Check output for details.');
                }
            }
            catch (error) {
                console.error('🎯 DEBUG: Orchestration error:', error);
                vscode.window.showErrorMessage(`Failed to orchestrate specification: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.queryMemoryBank', async () => {
            console.log('🎯 DEBUG: User executed command: queryMemoryBank');
            try {
                const query = await vscode.window.showInputBox({
                    prompt: 'Enter your memory bank query',
                    placeHolder: 'e.g., specifications, tasks, patterns, decisions',
                    ignoreFocusOut: true
                });
                if (!query) {
                    return;
                }
                const results = await hiveOrchestrator.queryMemoryBank(query);
                const outputChannel = vscode.window.createOutputChannel('Hive Mind Memory Bank');
                outputChannel.clear();
                outputChannel.appendLine('Hive Mind Memory Bank Query Results');
                outputChannel.appendLine('===================================\n');
                outputChannel.appendLine(`Query: ${query}`);
                outputChannel.appendLine(`Results Found: ${results.length}\n`);
                if (results.length > 0) {
                    results.forEach((result, index) => {
                        outputChannel.appendLine(`${index + 1}. ${JSON.stringify(result, null, 2)}`);
                        outputChannel.appendLine('');
                    });
                }
                else {
                    outputChannel.appendLine('No results found for your query.');
                }
                outputChannel.show();
                vscode.window.showInformationMessage(`🧠 Found ${results.length} results in memory bank`);
            }
            catch (error) {
                console.error('🎯 DEBUG: Memory bank query error:', error);
                vscode.window.showErrorMessage(`Failed to query memory bank: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.getHiveStatus', async () => {
            console.log('🎯 DEBUG: User executed command: getHiveStatus');
            try {
                const status = await hiveOrchestrator.getHiveStatus();
                const activeAgentsList = hiveOrchestrator.getActiveAgents();
                const outputChannel = vscode.window.createOutputChannel('Hive Mind Status');
                outputChannel.clear();
                outputChannel.appendLine('Hive Mind Status Report');
                outputChannel.appendLine('=======================\n');
                outputChannel.appendLine(`Initialized: ${status.isInitialized}`);
                outputChannel.appendLine(`Active Agents: ${status.activeAgents}`);
                outputChannel.appendLine(`Total Agents: ${status.totalAgents}`);
                outputChannel.appendLine(`Memory Usage: ${status.performance.memoryUsage}%`);
                outputChannel.appendLine(`Tasks Completed: ${status.completedTasks}`);
                outputChannel.appendLine(`Active Tasks: ${status.activeTasks}`);
                outputChannel.appendLine(`Health Status: ${status.health.status}\n`);
                if (activeAgentsList && activeAgentsList.length > 0) {
                    outputChannel.appendLine('Agent Details:');
                    activeAgentsList.forEach((agent, index) => {
                        outputChannel.appendLine(`${index + 1}. ${agent.type} (${agent.id})`);
                        outputChannel.appendLine(`   Status: ${agent.status}`);
                        outputChannel.appendLine(`   Tasks: ${agent.performance.tasksCompleted}`);
                        outputChannel.appendLine(`   Capabilities: ${agent.capabilities.join(', ')}`);
                        outputChannel.appendLine('');
                    });
                }
                outputChannel.show();
                const statusMessage = status.isInitialized
                    ? `🧠 Hive Mind: ${status.activeAgents}/${status.totalAgents} agents active`
                    : '🧠 Hive Mind: Not initialized';
                vscode.window.showInformationMessage(statusMessage);
            }
            catch (error) {
                console.error('🎯 DEBUG: Hive status error:', error);
                vscode.window.showErrorMessage(`Failed to get hive status: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.spawnSpecializedAgent', async () => {
            console.log('🎯 DEBUG: User executed command: spawnSpecializedAgent');
            try {
                const agentType = await vscode.window.showQuickPick([
                    { label: '🏗️ Architect', value: 'architect', description: 'System design and architecture' },
                    { label: '💻 Coder', value: 'coder', description: 'Code implementation and development' },
                    { label: '🧪 Tester', value: 'tester', description: 'Testing and quality assurance' },
                    { label: '📊 Analyst', value: 'analyst', description: 'Performance and code analysis' },
                    { label: '🔍 Researcher', value: 'researcher', description: 'Information gathering and research' }
                ], {
                    placeHolder: 'Select agent type to spawn',
                    ignoreFocusOut: true
                });
                if (!agentType) {
                    return;
                }
                vscode.window.showInformationMessage(`🚀 Spawning ${agentType.label} agent...`);
                const agent = await hiveOrchestrator.spawnSpecializedAgent(agentType.value);
                vscode.window.showInformationMessage(`✅ ${agentType.label} agent spawned successfully! ID: ${agent.id}`);
            }
            catch (error) {
                console.error('🎯 DEBUG: Agent spawn error:', error);
                vscode.window.showErrorMessage(`Failed to spawn agent: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.terminateAgent', async () => {
            console.log('🎯 DEBUG: User executed command: terminateAgent');
            try {
                const status = await hiveOrchestrator.getHiveStatus();
                const activeAgentsList = hiveOrchestrator.getActiveAgents();
                if (!activeAgentsList || activeAgentsList.length === 0) {
                    vscode.window.showInformationMessage('No active agents to terminate');
                    return;
                }
                const agentOptions = activeAgentsList.map(agent => ({
                    label: `${agent.type} (${agent.id})`,
                    value: agent.id,
                    description: `Status: ${agent.status}, Tasks: ${agent.performance.tasksCompleted}`
                }));
                const selectedAgent = await vscode.window.showQuickPick(agentOptions, {
                    placeHolder: 'Select agent to terminate',
                    ignoreFocusOut: true
                });
                if (!selectedAgent) {
                    return;
                }
                await hiveOrchestrator.terminateAgent(selectedAgent.value);
                vscode.window.showInformationMessage(`🔴 Agent ${selectedAgent.value} terminated successfully`);
            }
            catch (error) {
                console.error('🎯 DEBUG: Agent termination error:', error);
                vscode.window.showErrorMessage(`Failed to terminate agent: ${error}`);
            }
        }),
        vscode.commands.registerCommand('ruv-swarm.clearMemoryBank', async () => {
            console.log('🎯 DEBUG: User executed command: clearMemoryBank');
            try {
                const choice = await vscode.window.showWarningMessage('Are you sure you want to clear the entire memory bank? This action cannot be undone.', 'Clear Memory Bank', 'Cancel');
                if (choice === 'Clear Memory Bank') {
                    await hiveOrchestrator.clearMemoryBank();
                    vscode.window.showInformationMessage('🗑️ Memory bank cleared successfully');
                }
            }
            catch (error) {
                console.error('🎯 DEBUG: Memory bank clear error:', error);
                vscode.window.showErrorMessage(`Failed to clear memory bank: ${error}`);
            }
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
    // Register chat view provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(chatViewProvider_1.ChatViewProvider.viewType, chatViewProvider));
    // Register tree data providers for left panel views
    context.subscriptions.push(vscode.window.registerTreeDataProvider('ruv-swarm.swarmStatus', swarmStatusProvider));
    context.subscriptions.push(vscode.window.registerTreeDataProvider('ruv-swarm.activeAgents', activeAgentsProvider));
    context.subscriptions.push(vscode.window.registerTreeDataProvider('ruv-swarm.recentAnalysis', recentAnalysisProvider));
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
function convertSpecToMarkdown(spec) {
    let markdown = `# ${spec.title}\n\n`;
    markdown += `## Description\n${spec.description}\n\n`;
    if (spec.requirements && spec.requirements.length > 0) {
        markdown += `## Requirements\n`;
        spec.requirements.forEach((req, index) => {
            markdown += `${index + 1}. ${req}\n`;
        });
        markdown += '\n';
    }
    if (spec.architecture && spec.architecture.length > 0) {
        markdown += `## Architecture\n`;
        spec.architecture.forEach((arch) => {
            markdown += `- ${arch}\n`;
        });
        markdown += '\n';
    }
    if (spec.tasks && spec.tasks.length > 0) {
        markdown += `## Tasks\n`;
        spec.tasks.forEach((task, index) => {
            markdown += `### Task ${index + 1}: ${task.description}\n`;
            markdown += `- **Type**: ${task.type}\n`;
            markdown += `- **Agent**: ${task.assignedAgentType}\n`;
            markdown += `- **Duration**: ${task.estimatedDuration} hours\n`;
            if (task.dependencies && task.dependencies.length > 0) {
                markdown += `- **Dependencies**: ${task.dependencies.join(', ')}\n`;
            }
            if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
                markdown += `- **Acceptance Criteria**: ${task.acceptanceCriteria.join(', ')}\n`;
            }
            markdown += '\n';
        });
    }
    if (spec.acceptanceCriteria && spec.acceptanceCriteria.length > 0) {
        markdown += `## Acceptance Criteria\n`;
        spec.acceptanceCriteria.forEach((criteria) => {
            markdown += `- ${criteria}\n`;
        });
        markdown += '\n';
    }
    markdown += `## Project Details\n`;
    markdown += `- **Priority**: ${spec.priority}\n`;
    markdown += `- **Estimated Duration**: ${spec.estimatedDuration} hours\n`;
    if (spec.dependencies && spec.dependencies.length > 0) {
        markdown += `- **Dependencies**: ${spec.dependencies.join(', ')}\n`;
    }
    return markdown;
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