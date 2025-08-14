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
exports.WebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
class WebviewProvider {
    constructor(context, swarmManager) {
        this.context = context;
        this.swarmManager = swarmManager;
    }
    resolveWebviewView(webviewView, context, token) {
        this.webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };
        webviewView.webview.html = this.getWebviewContent();
        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async (message) => {
            await this.handleWebviewMessage(message);
        });
        // Start periodic updates
        this.startPeriodicUpdates();
        // Listen to swarm events
        this.swarmManager.onSwarmEvent((event) => {
            this.sendMessageToWebview({
                type: 'swarmEvent',
                payload: event,
                timestamp: new Date()
            });
        });
    }
    async showDashboard() {
        if (this.webviewView) {
            this.webviewView.show(true);
            await this.updateDashboard();
        }
        else {
            // Create a new webview panel if view is not available
            const panel = vscode.window.createWebviewPanel('ruvSwarmDashboard', 'RUV-Swarm Dashboard', vscode.ViewColumn.Two, {
                enableScripts: true,
                localResourceRoots: [this.context.extensionUri]
            });
            panel.webview.html = this.getDashboardHTML();
            panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message);
            });
            // Update dashboard data
            await this.updateDashboardPanel(panel);
        }
    }
    async handleWebviewMessage(message) {
        switch (message.type) {
            case 'getDashboardData':
                await this.updateDashboard();
                break;
            case 'initializeSwarm':
                try {
                    await this.swarmManager.initializeSwarm();
                    vscode.window.showInformationMessage('🧠 Swarm initialized successfully!');
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Failed to initialize swarm: ${errorMessage}`);
                }
                break;
            case 'spawnAgent':
                try {
                    const { type, name, capabilities } = message.payload;
                    await this.swarmManager.spawnAgent(type, name, capabilities);
                    vscode.window.showInformationMessage(`🤖 Agent ${name} spawned successfully!`);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Failed to spawn agent: ${errorMessage}`);
                }
                break;
            case 'executeTask':
                try {
                    const { description, type, filePath } = message.payload;
                    await this.swarmManager.executeTask(description, type, filePath);
                    vscode.window.showInformationMessage('✅ Task completed successfully!');
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`Task failed: ${errorMessage}`);
                }
                break;
            default:
                console.warn('Unknown webview message type:', message.type);
        }
    }
    async updateDashboard() {
        const dashboardData = await this.getDashboardData();
        this.sendMessageToWebview({
            type: 'dashboardUpdate',
            payload: dashboardData,
            timestamp: new Date()
        });
    }
    async updateDashboardPanel(panel) {
        const dashboardData = await this.getDashboardData();
        panel.webview.postMessage({
            type: 'dashboardUpdate',
            payload: dashboardData,
            timestamp: new Date()
        });
    }
    sendMessageToWebview(message) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage(message);
        }
    }
    async getDashboardData() {
        const swarmStatus = await this.swarmManager.getSwarmStatus();
        const agents = this.swarmManager.getAgents();
        const tasks = this.swarmManager.getTasks();
        return {
            swarmStatus,
            agents,
            recentTasks: tasks.slice(-10), // Last 10 tasks
            recentAnalysis: [], // Would be populated from analysis history
            performance: swarmStatus.performance
        };
    }
    startPeriodicUpdates() {
        // Update dashboard every 5 seconds
        this.updateInterval = setInterval(async () => {
            await this.updateDashboard();
        }, 5000);
    }
    getWebviewContent() {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>RUV-Swarm Dashboard</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 10px;
                }
                
                .header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                .header h1 {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .status-indicator {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    margin-right: 8px;
                }
                
                .status-healthy { background-color: #28a745; }
                .status-degraded { background-color: #ffc107; }
                .status-critical { background-color: #dc3545; }
                .status-offline { background-color: #6c757d; }
                
                .section {
                    margin-bottom: 20px;
                    padding: 15px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 4px;
                }
                
                .section h3 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }
                
                .metric {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-size: 12px;
                }
                
                .metric-value {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }
                
                .agent-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px;
                    margin: 5px 0;
                    background-color: var(--vscode-input-background);
                    border-radius: 3px;
                    font-size: 12px;
                }
                
                .agent-status {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 600;
                }
                
                .agent-status.idle { background-color: var(--vscode-button-secondaryBackground); }
                .agent-status.active { background-color: var(--vscode-button-background); }
                .agent-status.busy { background-color: var(--vscode-notificationsWarningIcon-foreground); }
                .agent-status.error { background-color: var(--vscode-notificationsErrorIcon-foreground); }
                
                .task-item {
                    padding: 8px;
                    margin: 5px 0;
                    background-color: var(--vscode-input-background);
                    border-radius: 3px;
                    font-size: 12px;
                }
                
                .task-description {
                    font-weight: 600;
                    margin-bottom: 4px;
                }
                
                .task-meta {
                    color: var(--vscode-descriptionForeground);
                    font-size: 10px;
                }
                
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 6px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                    margin: 2px;
                }
                
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .button-secondary {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                
                .button-secondary:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                
                .actions {
                    margin-top: 15px;
                    text-align: center;
                }
                
                .loading {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div id="statusIndicator" class="status-indicator status-offline"></div>
                <h1>RUV-Swarm</h1>
            </div>
            
            <div id="content" class="loading">
                Loading dashboard...
            </div>
            
            <div class="actions">
                <button class="button" onclick="initializeSwarm()">Initialize Swarm</button>
                <button class="button button-secondary" onclick="refreshDashboard()">Refresh</button>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function initializeSwarm() {
                    vscode.postMessage({
                        type: 'initializeSwarm',
                        payload: {},
                        timestamp: new Date()
                    });
                }
                
                function refreshDashboard() {
                    vscode.postMessage({
                        type: 'getDashboardData',
                        payload: {},
                        timestamp: new Date()
                    });
                }
                
                function spawnAgent(type, name) {
                    vscode.postMessage({
                        type: 'spawnAgent',
                        payload: { type, name, capabilities: [] },
                        timestamp: new Date()
                    });
                }
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'dashboardUpdate':
                            updateDashboard(message.payload);
                            break;
                        case 'swarmEvent':
                            handleSwarmEvent(message.payload);
                            break;
                    }
                });
                
                function updateDashboard(data) {
                    const statusIndicator = document.getElementById('statusIndicator');
                    const content = document.getElementById('content');
                    
                    // Update status indicator
                    statusIndicator.className = 'status-indicator status-' + data.swarmStatus.health.status;
                    
                    // Update content
                    content.innerHTML = generateDashboardHTML(data);
                }
                
                function generateDashboardHTML(data) {
                    return \`
                        <div class="section">
                            <h3>Swarm Status</h3>
                            <div class="metric">
                                <span>Topology:</span>
                                <span class="metric-value">\${data.swarmStatus.topology}</span>
                            </div>
                            <div class="metric">
                                <span>Active Agents:</span>
                                <span class="metric-value">\${data.swarmStatus.activeAgents}/\${data.swarmStatus.totalAgents}</span>
                            </div>
                            <div class="metric">
                                <span>Active Tasks:</span>
                                <span class="metric-value">\${data.swarmStatus.activeTasks}</span>
                            </div>
                            <div class="metric">
                                <span>Completed Tasks:</span>
                                <span class="metric-value">\${data.swarmStatus.completedTasks}</span>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h3>Performance</h3>
                            <div class="metric">
                                <span>Tasks/Second:</span>
                                <span class="metric-value">\${data.performance.tasksPerSecond.toFixed(2)}</span>
                            </div>
                            <div class="metric">
                                <span>Avg Response Time:</span>
                                <span class="metric-value">\${data.performance.averageResponseTime.toFixed(0)}ms</span>
                            </div>
                            <div class="metric">
                                <span>Success Rate:</span>
                                <span class="metric-value">\${(data.performance.successRate * 100).toFixed(1)}%</span>
                            </div>
                            <div class="metric">
                                <span>Token Efficiency:</span>
                                <span class="metric-value">\${(data.performance.tokenEfficiency * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h3>Active Agents (\${data.agents.length})</h3>
                            \${data.agents.map(agent => \`
                                <div class="agent-item">
                                    <div>
                                        <strong>\${agent.name}</strong><br>
                                        <small>\${agent.type} • \${agent.model}</small>
                                    </div>
                                    <div class="agent-status \${agent.status}">\${agent.status}</div>
                                </div>
                            \`).join('')}
                            \${data.agents.length === 0 ? '<div class="loading">No agents spawned</div>' : ''}
                        </div>
                        
                        <div class="section">
                            <h3>Recent Tasks</h3>
                            \${data.recentTasks.slice(-5).map(task => \`
                                <div class="task-item">
                                    <div class="task-description">\${task.description}</div>
                                    <div class="task-meta">
                                        \${task.type} • \${task.status} • \${new Date(task.createdAt).toLocaleTimeString()}
                                    </div>
                                </div>
                            \`).join('')}
                            \${data.recentTasks.length === 0 ? '<div class="loading">No recent tasks</div>' : ''}
                        </div>
                    \`;
                }
                
                function handleSwarmEvent(event) {
                    // Handle real-time swarm events
                    console.log('Swarm event:', event);
                    
                    // Refresh dashboard on significant events
                    if (['swarm.initialized', 'agent.spawned', 'task.completed'].includes(event.type)) {
                        setTimeout(refreshDashboard, 1000);
                    }
                }
                
                // Initial load
                refreshDashboard();
            </script>
        </body>
        </html>
        `;
    }
    getDashboardHTML() {
        // Similar to getWebviewContent but for standalone panel
        return this.getWebviewContent();
    }
    dispose() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}
exports.WebviewProvider = WebviewProvider;
//# sourceMappingURL=webviewProvider.js.map