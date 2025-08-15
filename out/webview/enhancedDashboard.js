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
exports.EnhancedDashboard = void 0;
const vscode = __importStar(require("vscode"));
class EnhancedDashboard {
    constructor(context, swarmManager, commandManager) {
        this.isStreaming = false;
        this.commandButtons = [
            // Core Commands
            {
                id: 'init-swarm',
                label: 'Initialize Swarm',
                icon: '🧠',
                description: 'Initialize the RUV-Swarm system',
                command: 'ruv-swarm.initializeSwarm',
                category: 'core',
                enabled: true
            },
            {
                id: 'spawn-agent',
                label: 'Spawn Agent',
                icon: '🤖',
                description: 'Spawn a new coding agent',
                command: 'ruv-swarm.spawnCodingAgent',
                requiresSwarm: true,
                category: 'core',
                enabled: false
            },
            // Analysis Commands
            {
                id: 'analyze-file',
                label: 'Analyze File',
                icon: '🔍',
                description: 'Analyze the current file for improvements',
                command: 'ruv-swarm.analyzeCurrentFile',
                requiresFile: true,
                requiresSwarm: true,
                category: 'analysis',
                enabled: false
            },
            {
                id: 'security-scan',
                label: 'Security Scan',
                icon: '🔒',
                description: 'Perform security analysis on current file',
                command: 'ruv-swarm.securityAnalysis',
                requiresFile: true,
                requiresSwarm: true,
                category: 'analysis',
                enabled: false
            },
            {
                id: 'code-review',
                label: 'Code Review',
                icon: '👥',
                description: 'Perform comprehensive code review',
                command: 'ruv-swarm.codeReview',
                requiresSwarm: true,
                category: 'analysis',
                enabled: false
            },
            {
                id: 'explain-code',
                label: 'Explain Code',
                icon: '📖',
                description: 'Explain selected code with detailed comments',
                command: 'ruv-swarm.explainCode',
                requiresFile: true,
                requiresSelection: true,
                requiresSwarm: true,
                category: 'analysis',
                enabled: false
            },
            // Generation Commands
            {
                id: 'generate-tests',
                label: 'Generate Tests',
                icon: '🧪',
                description: 'Generate comprehensive unit tests',
                command: 'ruv-swarm.generateTests',
                requiresFile: true,
                requiresSwarm: true,
                category: 'generation',
                enabled: false
            },
            {
                id: 'refactor-code',
                label: 'Refactor Code',
                icon: '🔧',
                description: 'Refactor code for better maintainability',
                command: 'ruv-swarm.refactorCode',
                requiresFile: true,
                requiresSwarm: true,
                category: 'generation',
                enabled: false
            },
            {
                id: 'optimize-performance',
                label: 'Optimize Performance',
                icon: '⚡',
                description: 'Analyze and optimize performance',
                command: 'ruv-swarm.optimizePerformance',
                requiresFile: true,
                requiresSwarm: true,
                category: 'generation',
                enabled: false
            },
            // Monitoring Commands
            {
                id: 'monitor-swarm',
                label: 'Monitor Swarm',
                icon: '📊',
                description: 'Monitor swarm performance and status',
                command: 'ruv-swarm.monitorSwarm',
                requiresSwarm: true,
                category: 'monitoring',
                enabled: false
            },
            {
                id: 'benchmark',
                label: 'Benchmark',
                icon: '🏃',
                description: 'Run performance benchmarks',
                command: 'ruv-swarm.benchmarkPerformance',
                requiresSwarm: true,
                category: 'monitoring',
                enabled: false
            }
        ];
        this.context = context;
        this.swarmManager = swarmManager;
        this.commandManager = commandManager;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Enhanced Dashboard');
        this.setupEventListeners();
    }
    async showDashboard() {
        try {
            this.outputChannel.appendLine('🎛️ Opening Enhanced Dashboard...');
            if (this.dashboardPanel) {
                this.dashboardPanel.reveal(vscode.ViewColumn.Two);
                await this.updateDashboard();
                return;
            }
            this.dashboardPanel = vscode.window.createWebviewPanel('ruvSwarmEnhancedDashboard', 'RUV-Swarm Dashboard', vscode.ViewColumn.Two, {
                enableScripts: true,
                localResourceRoots: [this.context.extensionUri],
                retainContextWhenHidden: true
            });
            // Handle panel disposal
            this.dashboardPanel.onDidDispose(() => {
                this.dashboardPanel = undefined;
                this.stopRealTimeUpdates();
                this.outputChannel.appendLine('🎛️ Dashboard panel disposed');
            });
            // Handle messages from webview
            this.dashboardPanel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message);
            });
            // Set initial content
            this.dashboardPanel.webview.html = this.generateDashboardHTML();
            // Start real-time updates
            await this.startRealTimeUpdates();
            this.outputChannel.appendLine('✅ Enhanced Dashboard opened successfully!');
            vscode.window.showInformationMessage('📊 Enhanced Dashboard opened!');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to open dashboard: ${error}`);
            vscode.window.showErrorMessage(`Failed to open dashboard: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async handleWebviewMessage(message) {
        try {
            this.outputChannel.appendLine(`📨 Received message: ${message.type}`);
            switch (message.type) {
                case 'executeCommand':
                    await this.executeCommand(message.commandId);
                    break;
                case 'requestUpdate':
                    await this.updateDashboard();
                    break;
                case 'toggleStreaming':
                    if (this.isStreaming) {
                        this.stopRealTimeUpdates();
                    }
                    else {
                        await this.startRealTimeUpdates();
                    }
                    break;
                case 'spawnAgent':
                    await this.spawnAgentFromDashboard(message.agentType, message.agentName);
                    break;
                case 'terminateAgent':
                    await this.terminateAgent(message.agentId);
                    break;
                case 'cancelTask':
                    await this.cancelTask(message.taskId);
                    break;
                default:
                    this.outputChannel.appendLine(`⚠️ Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error handling message: ${error}`);
        }
    }
    async executeCommand(commandId) {
        const button = this.commandButtons.find(b => b.id === commandId);
        if (!button) {
            vscode.window.showErrorMessage(`Unknown command: ${commandId}`);
            return;
        }
        if (!button.enabled) {
            vscode.window.showWarningMessage(`Command "${button.label}" is not available right now`);
            return;
        }
        try {
            this.outputChannel.appendLine(`🎯 Executing command: ${button.command}`);
            await vscode.commands.executeCommand(button.command);
            // Update dashboard after command execution
            setTimeout(() => this.updateDashboard(), 1000);
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Command execution failed: ${error}`);
            vscode.window.showErrorMessage(`Command failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async spawnAgentFromDashboard(type, name) {
        try {
            const agentId = await this.swarmManager.spawnAgent(type, name);
            vscode.window.showInformationMessage(`🤖 Agent ${name || agentId} spawned successfully!`);
            await this.updateDashboard();
        }
        catch (error) {
            vscode.window.showErrorMessage(`Failed to spawn agent: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async terminateAgent(agentId) {
        // This would need to be implemented in SwarmManager
        vscode.window.showInformationMessage(`🤖 Agent ${agentId} terminated`);
        await this.updateDashboard();
    }
    async cancelTask(taskId) {
        // This would need to be implemented in SwarmManager
        vscode.window.showInformationMessage(`📋 Task ${taskId} cancelled`);
        await this.updateDashboard();
    }
    updateCommandStates() {
        const activeEditor = vscode.window.activeTextEditor;
        const hasFile = !!activeEditor;
        const hasSelection = !!(activeEditor?.selection && !activeEditor.selection.isEmpty);
        const swarmInitialized = this.swarmManager.getSwarmStatus().then(status => status.isInitialized);
        swarmInitialized.then(isInitialized => {
            this.commandButtons.forEach(button => {
                let enabled = true;
                if (button.requiresFile && !hasFile) {
                    enabled = false;
                }
                if (button.requiresSelection && !hasSelection) {
                    enabled = false;
                }
                if (button.requiresSwarm && !isInitialized) {
                    enabled = false;
                }
                button.enabled = enabled;
            });
        });
    }
    async startRealTimeUpdates() {
        if (this.isStreaming)
            return;
        this.isStreaming = true;
        this.updateInterval = setInterval(async () => {
            await this.updateDashboard();
        }, 2000); // Update every 2 seconds
        this.outputChannel.appendLine('🔄 Started real-time updates');
    }
    stopRealTimeUpdates() {
        if (!this.isStreaming)
            return;
        this.isStreaming = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
        this.outputChannel.appendLine('⏸️ Stopped real-time updates');
    }
    async updateDashboard() {
        if (!this.dashboardPanel)
            return;
        try {
            this.updateCommandStates();
            const dashboardData = await this.getDashboardData();
            this.dashboardPanel.webview.postMessage({
                type: 'dashboardUpdate',
                data: dashboardData,
                commands: this.commandButtons,
                streaming: this.isStreaming,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            this.outputChannel.appendLine(`⚠️ Dashboard update failed: ${error}`);
        }
    }
    async getDashboardData() {
        const swarmStatus = await this.swarmManager.getSwarmStatus();
        const agents = this.swarmManager.getAgents();
        const tasks = this.swarmManager.getTasks();
        return {
            swarmStatus,
            agents,
            recentTasks: tasks.slice(-10),
            recentAnalysis: [],
            performance: swarmStatus.performance
        };
    }
    setupEventListeners() {
        // Listen to swarm events
        this.swarmManager.onSwarmEvent((event) => {
            if (this.dashboardPanel) {
                this.dashboardPanel.webview.postMessage({
                    type: 'swarmEvent',
                    event: event
                });
            }
        });
        // Listen to active editor changes
        vscode.window.onDidChangeActiveTextEditor(() => {
            this.updateCommandStates();
            if (this.dashboardPanel) {
                setTimeout(() => this.updateDashboard(), 100);
            }
        });
        // Listen to selection changes
        vscode.window.onDidChangeTextEditorSelection(() => {
            this.updateCommandStates();
            if (this.dashboardPanel) {
                setTimeout(() => this.updateDashboard(), 100);
            }
        });
    }
    generateDashboardHTML() {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>RUV-Swarm Enhanced Dashboard</title>
            <style>
                :root {
                    --primary-color: #007acc;
                    --success-color: #28a745;
                    --warning-color: #ffc107;
                    --danger-color: #dc3545;
                    --info-color: #17a2b8;
                    --border-radius: 6px;
                    --spacing: 12px;
                    --transition: all 0.2s ease;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: var(--spacing);
                    line-height: 1.5;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: calc(var(--spacing) * 2);
                    padding-bottom: var(--spacing);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }

                .dashboard-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing);
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }

                .status-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                }

                .status-healthy { background-color: var(--success-color); }
                .status-degraded { background-color: var(--warning-color); }
                .status-critical { background-color: var(--danger-color); }
                .status-offline { background-color: var(--vscode-descriptionForeground); }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .header-controls {
                    display: flex;
                    gap: var(--spacing);
                    align-items: center;
                }

                .dashboard-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--spacing);
                    margin-bottom: calc(var(--spacing) * 2);
                }

                .dashboard-panel {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: var(--border-radius);
                    padding: var(--spacing);
                    transition: var(--transition);
                }

                .dashboard-panel:hover {
                    border-color: var(--primary-color);
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: var(--spacing);
                }

                .panel-title {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .command-center {
                    grid-column: 1 / -1;
                    margin-bottom: calc(var(--spacing) * 2);
                }

                .command-categories {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: var(--spacing);
                }

                .command-category {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: var(--border-radius);
                    padding: var(--spacing);
                }

                .category-title {
                    margin: 0 0 var(--spacing) 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .command-buttons {
                    display: flex;
                    flex-direction: column;
                    gap: calc(var(--spacing) / 2);
                }

                .command-button {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing);
                    padding: calc(var(--spacing) / 2) var(--spacing);
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: var(--transition);
                    text-align: left;
                    width: 100%;
                }

                .command-button:hover:not(:disabled) {
                    background-color: var(--vscode-button-hoverBackground);
                    transform: translateY(-1px);
                }

                .command-button:disabled {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-descriptionForeground);
                    cursor: not-allowed;
                    opacity: 0.6;
                }

                .command-icon {
                    font-size: 16px;
                    min-width: 20px;
                }

                .command-info {
                    flex: 1;
                }

                .command-label {
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .command-description {
                    font-size: 11px;
                    opacity: 0.8;
                    line-height: 1.3;
                }

                .metrics-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--spacing);
                }

                .metric {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: calc(var(--spacing) / 2);
                    background-color: var(--vscode-input-background);
                    border-radius: var(--border-radius);
                    font-size: 12px;
                }

                .metric-label {
                    color: var(--vscode-descriptionForeground);
                }

                .metric-value {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .agent-list, .task-list {
                    max-height: 200px;
                    overflow-y: auto;
                }

                .agent-item, .task-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: calc(var(--spacing) / 2);
                    margin-bottom: calc(var(--spacing) / 2);
                    background-color: var(--vscode-input-background);
                    border-radius: var(--border-radius);
                    font-size: 12px;
                    transition: var(--transition);
                }

                .agent-item:hover, .task-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }

                .agent-info, .task-info {
                    flex: 1;
                }

                .agent-name, .task-description {
                    font-weight: 600;
                    margin-bottom: 2px;
                }

                .agent-details, .task-details {
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                }

                .status-badge {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .status-idle { background-color: var(--vscode-button-secondaryBackground); }
                .status-active { background-color: var(--success-color); color: white; }
                .status-busy { background-color: var(--warning-color); color: black; }
                .status-error { background-color: var(--danger-color); color: white; }
                .status-running { background-color: var(--info-color); color: white; }
                .status-completed { background-color: var(--success-color); color: white; }
                .status-failed { background-color: var(--danger-color); color: white; }

                .action-button {
                    padding: 2px 6px;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: var(--transition);
                }

                .action-button:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .streaming-toggle {
                    display: flex;
                    align-items: center;
                    gap: calc(var(--spacing) / 2);
                    padding: calc(var(--spacing) / 2) var(--spacing);
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 12px;
                    transition: var(--transition);
                }

                .streaming-toggle.active {
                    background-color: var(--success-color);
                    color: white;
                }

                .streaming-toggle:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .streaming-toggle.active:hover {
                    background-color: #218838;
                }

                .empty-state {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: calc(var(--spacing) * 2);
                }

                .loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: var(--spacing);
                    padding: calc(var(--spacing) * 2);
                    color: var(--vscode-descriptionForeground);
                }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--vscode-descriptionForeground);
                    border-top: 2px solid var(--primary-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .last-update {
                    font-size: 11px;
                    color: var(--vscode-descriptionForeground);
                    text-align: center;
                    margin-top: var(--spacing);
                }
            </style>
        </head>
        <body>
            <div class="dashboard-header">
                <h1 class="dashboard-title">
                    <div id="statusIndicator" class="status-indicator status-offline"></div>
                    RUV-Swarm Enhanced Dashboard
                </h1>
                <div class="header-controls">
                    <button id="streamingToggle" class="streaming-toggle">
                        <span id="streamingIcon">▶️</span>
                        <span id="streamingText">Start Streaming</span>
                    </button>
                </div>
            </div>

            <div class="command-center dashboard-panel">
                <div class="panel-header">
                    <h2 class="panel-title">🎛️ Command Center</h2>
                </div>
                <div id="commandCategories" class="command-categories">
                    <div class="loading">
                        <div class="spinner"></div>
                        Loading commands...
                    </div>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="dashboard-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">📊 System Metrics</h3>
                    </div>
                    <div id="systemMetrics" class="metrics-grid">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading metrics...
                        </div>
                    </div>
                </div>

                <div class="dashboard-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">⚡ Performance</h3>
                    </div>
                    <div id="performanceMetrics" class="metrics-grid">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading performance...
                        </div>
                    </div>
                </div>

                <div class="dashboard-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">🤖 Active Agents</h3>
                    </div>
                    <div id="agentList" class="agent-list">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading agents...
                        </div>
                    </div>
                </div>

                <div class="dashboard-panel">
                    <div class="panel-header">
                        <h3 class="panel-title">📋 Recent Tasks</h3>
                    </div>
                    <div id="taskList" class="task-list">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading tasks...
                        </div>
                    </div>
                </div>
            </div>

            <div class="last-update">
                Last updated: <span id="lastUpdate">Never</span>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentData = null;
                let currentCommands = [];
                let isStreaming = false;

                // Initialize dashboard
                document.addEventListener('DOMContentLoaded', () => {
                    setupEventListeners();
                    requestUpdate();
                });

                function setupEventListeners() {
                    document.getElementById('streamingToggle').addEventListener('click', toggleStreaming);
                }

                function toggleStreaming() {
                    vscode.postMessage({ type: 'toggleStreaming' });
                }

                function requestUpdate() {
                    vscode.postMessage({ type: 'requestUpdate' });
                }

                function executeCommand(commandId) {
                    vscode.postMessage({ 
                        type: 'executeCommand', 
                        commandId: commandId 
                    });
                }

                function spawnAgent() {
                    const agentType = prompt('Enter agent type (coder, analyst, optimizer):') || 'coder';
                    const agentName = prompt('Enter agent name (optional):') || undefined;
                    
                    vscode.postMessage({ 
                        type: 'spawnAgent', 
                        agentType: agentType,
                        agentName: agentName
                    });
                }

                function terminateAgent(agentId) {
                    if (confirm('Are you sure you want to terminate this agent?')) {
                        vscode.postMessage({ 
                            type: 'terminateAgent', 
                            agentId: agentId 
                        });
                    }
                }

                function cancelTask(taskId) {
                    if (confirm('Are you sure you want to cancel this task?')) {
                        vscode.postMessage({ 
                            type: 'cancelTask', 
                            taskId: taskId 
                        });
                    }
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'dashboardUpdate':
                            updateDashboard(message.data, message.commands, message.streaming);
                            document.getElementById('lastUpdate').textContent = new Date(message.timestamp).toLocaleTimeString();
                            break;
                        case 'swarmEvent':
                            handleSwarmEvent(message.event);
                            break;
                    }
                });

                function updateDashboard(data, commands, streaming) {
                    currentData = data;
                    currentCommands = commands;
                    isStreaming = streaming;

                    // Update status indicator
                    const statusIndicator = document.getElementById('statusIndicator');
                    statusIndicator.className = 'status-indicator status-' + data.swarmStatus.health.status;

                    // Update streaming toggle
                    const streamingToggle = document.getElementById('streamingToggle');
                    const streamingIcon = document.getElementById('streamingIcon');
                    const streamingText = document.getElementById('streamingText');
                    
                    if (isStreaming) {
                        streamingToggle.classList.add('active');
                        streamingIcon.textContent = '⏸️';
                        streamingText.textContent = 'Stop Streaming';
                    } else {
                        streamingToggle.classList.remove('active');
                        streamingIcon.textContent = '▶️';
                        streamingText.textContent = 'Start Streaming';
                    }

                    // Update command center
                    updateCommandCenter(commands);

                    // Update metrics
                    updateSystemMetrics(data);
                    updatePerformanceMetrics(data);

                    // Update agents and tasks
                    updateAgentList(data.agents);
                    updateTaskList(data.recentTasks);
                }

                function updateCommandCenter(commands) {
                    const commandCategories = document.getElementById('commandCategories');
                    const categories = ['core', 'analysis', 'generation', 'monitoring'];
                    
                    const categoryTitles = {
                        core: 'Core Operations',
                        analysis: 'Code Analysis',
                        generation: 'Code Generation',
                        monitoring: 'Monitoring & Performance'
                    };

                    commandCategories.innerHTML = categories.map(category => {
                        const categoryCommands = commands.filter(cmd => cmd.category === category);
                        
                        return \`
                            <div class="command-category">
                                <h4 class="category-title">\${categoryTitles[category]}</h4>
                                <div class="command-buttons">
                                    \${categoryCommands.map(cmd => \`
                                        <button 
                                            class="command-button" 
                                            onclick="executeCommand('\${cmd.id}')"
                                            \${!cmd.enabled ? 'disabled' : ''}
                                            title="\${cmd.description}"
                                        >
                                            <span class="command-icon">\${cmd.icon}</span>
                                            <div class="command-info">
                                                <div class="command-label">\${cmd.label}</div>
                                                <div class="command-description">\${cmd.description}</div>
                                            </div>
                                        </button>
                                    \`).join('')}
                                </div>
                            </div>
                        \`;
                    }).join('');
                }

                function updateSystemMetrics(data) {
                    const systemMetrics = document.getElementById('systemMetrics');
                    systemMetrics.innerHTML = \`
                        <div class="metric">
                            <span class="metric-label">Topology</span>
                            <span class="metric-value">\${data.swarmStatus.topology}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Active Agents</span>
                            <span class="metric-value">\${data.swarmStatus.activeAgents}/\${data.swarmStatus.totalAgents}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Active Tasks</span>
                            <span class="metric-value">\${data.swarmStatus.activeTasks}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Completed Tasks</span>
                            <span class="metric-value">\${data.swarmStatus.completedTasks}</span>
                        </div>
                    \`;
                }

                function updatePerformanceMetrics(data) {
                    const performanceMetrics = document.getElementById('performanceMetrics');
                    performanceMetrics.innerHTML = \`
                        <div class="metric">
                            <span class="metric-label">Tasks/Second</span>
                            <span class="metric-value">\${data.performance.tasksPerSecond.toFixed(2)}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Avg Response</span>
                            <span class="metric-value">\${data.performance.averageResponseTime.toFixed(0)}ms</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Success Rate</span>
                            <span class="metric-value">\${(data.performance.successRate * 100).toFixed(1)}%</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Token Efficiency</span>
                            <span class="metric-value">\${(data.performance.tokenEfficiency * 100).toFixed(1)}%</span>
                        </div>
                    \`;
                }

                function updateAgentList(agents) {
                    const agentList = document.getElementById('agentList');
                    
                    if (agents.length === 0) {
                        agentList.innerHTML = '<div class="empty-state">No agents spawned</div>';
                        return;
                    }

                    agentList.innerHTML = agents.map(agent => \`
                        <div class="agent-item">
                            <div class="agent-info">
                                <div class="agent-name">\${agent.name}</div>
                                <div class="agent-details">\${agent.type} • \${agent.model}</div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span class="status-badge status-\${agent.status}">\${agent.status}</span>
                                <button class="action-button" onclick="terminateAgent('\${agent.id}')">×</button>
                            </div>
                        </div>
                    \`).join('');
                }

                function updateTaskList(tasks) {
                    const taskList = document.getElementById('taskList');
                    
                    if (tasks.length === 0) {
                        taskList.innerHTML = '<div class="empty-state">No recent tasks</div>';
                        return;
                    }

                    taskList.innerHTML = tasks.slice(-5).map(task => \`
                        <div class="task-item">
                            <div class="task-info">
                                <div class="task-description">\${task.description}</div>
                                <div class="task-details">
                                    \${task.type} • \${new Date(task.createdAt).toLocaleTimeString()}
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <span class="status-badge status-\${task.status}">\${task.status}</span>
                                \${task.status === 'running' ? \`<button class="action-button" onclick="cancelTask('\${task.id}')">×</button>\` : ''}
                            </div>
                        </div>
                    \`).join('');
                }

                function handleSwarmEvent(event) {
                    console.log('Swarm event:', event);
                    
                    // Show notification for important events
                    if (['swarm.initialized', 'agent.spawned', 'task.completed'].includes(event.type)) {
                        // Could add toast notifications here
                        setTimeout(requestUpdate, 500);
                    }
                }
            </script>
        </body>
        </html>
        `;
    }
    dispose() {
        this.stopRealTimeUpdates();
        if (this.dashboardPanel) {
            this.dashboardPanel.dispose();
        }
        this.outputChannel.dispose();
    }
}
exports.EnhancedDashboard = EnhancedDashboard;
//# sourceMappingURL=enhancedDashboard.js.map