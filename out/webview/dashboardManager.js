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
exports.DashboardManager = void 0;
const vscode = __importStar(require("vscode"));
const websocketServer_1 = require("../streaming/websocketServer");
const dataStreamer_1 = require("../streaming/dataStreamer");
class DashboardManager {
    constructor(context, swarmManager, fileWatcher, errorHandler) {
        this.availableLayouts = new Map();
        this.isStreaming = false;
        this.context = context;
        this.swarmManager = swarmManager;
        this.fileWatcher = fileWatcher;
        this.errorHandler = errorHandler;
        this.webSocketServer = new websocketServer_1.WebSocketServer();
        this.dataStreamer = new dataStreamer_1.DataStreamer();
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Dashboard');
        // Initialize default layout
        this.currentLayout = this.createDefaultLayout();
        this.availableLayouts.set(this.currentLayout.id, this.currentLayout);
        this.setupEventListeners();
    }
    async initialize() {
        try {
            this.outputChannel.appendLine('🎛️ Initializing Dashboard Manager...');
            // Initialize WebSocket server for real-time updates
            await this.webSocketServer.initialize();
            // Initialize data streamer
            await this.dataStreamer.initialize();
            // Load saved layouts
            await this.loadSavedLayouts();
            this.outputChannel.appendLine('✅ Dashboard Manager initialized successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize dashboard: ${errorMessage}`);
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'DASHBOARD_INIT',
                    component: 'DashboardManager'
                }, { severity: 'high' });
            }
        }
    }
    async showDashboard(layoutId) {
        try {
            // Use specified layout or current layout
            if (layoutId && this.availableLayouts.has(layoutId)) {
                this.currentLayout = this.availableLayouts.get(layoutId);
            }
            // Create or show existing panel
            if (this.dashboardPanel) {
                this.dashboardPanel.reveal(vscode.ViewColumn.Two);
            }
            else {
                await this.createDashboardPanel();
            }
            // Start real-time updates
            await this.startRealTimeUpdates();
            this.outputChannel.appendLine(`📊 Dashboard opened with layout: ${this.currentLayout.name}`);
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'SHOW_DASHBOARD',
                    component: 'DashboardManager'
                }, { severity: 'medium' });
            }
        }
    }
    async switchLayout(layoutId) {
        if (!this.availableLayouts.has(layoutId)) {
            vscode.window.showErrorMessage(`Layout '${layoutId}' not found`);
            return;
        }
        this.currentLayout = this.availableLayouts.get(layoutId);
        if (this.dashboardPanel) {
            await this.updateDashboardContent();
        }
        this.outputChannel.appendLine(`🔄 Switched to layout: ${this.currentLayout.name}`);
    }
    async saveLayout(layout) {
        this.availableLayouts.set(layout.id, layout);
        await this.persistLayouts();
        this.outputChannel.appendLine(`💾 Saved layout: ${layout.name}`);
    }
    async deleteLayout(layoutId) {
        if (this.availableLayouts.get(layoutId)?.isDefault) {
            vscode.window.showErrorMessage('Cannot delete default layout');
            return;
        }
        this.availableLayouts.delete(layoutId);
        await this.persistLayouts();
        // Switch to default if current layout was deleted
        if (this.currentLayout.id === layoutId) {
            const defaultLayout = Array.from(this.availableLayouts.values())
                .find(l => l.isDefault);
            if (defaultLayout) {
                this.currentLayout = defaultLayout;
                if (this.dashboardPanel) {
                    await this.updateDashboardContent();
                }
            }
        }
        this.outputChannel.appendLine(`🗑️ Deleted layout: ${layoutId}`);
    }
    getAvailableLayouts() {
        return Array.from(this.availableLayouts.values());
    }
    async exportData(format) {
        try {
            const data = await this.collectDashboardData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `ruv-swarm-dashboard-${timestamp}.${format}`;
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(filename),
                filters: {
                    'JSON': ['json'],
                    'CSV': ['csv'],
                    'Excel': ['xlsx']
                }
            });
            if (uri) {
                await this.writeDataToFile(data, uri, format);
                vscode.window.showInformationMessage(`Dashboard data exported to ${uri.fsPath}`);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'EXPORT_DATA',
                    component: 'DashboardManager'
                }, { severity: 'medium' });
            }
        }
    }
    async createDashboardPanel() {
        this.dashboardPanel = vscode.window.createWebviewPanel('ruvSwarmDashboard', 'RUV-Swarm Dashboard', vscode.ViewColumn.Two, {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
            retainContextWhenHidden: true
        });
        // Handle panel disposal
        this.dashboardPanel.onDidDispose(() => {
            this.dashboardPanel = undefined;
            this.stopRealTimeUpdates();
        });
        // Handle messages from webview
        this.dashboardPanel.webview.onDidReceiveMessage(async (message) => {
            await this.handleWebviewMessage(message);
        });
        // Set initial content
        await this.updateDashboardContent();
    }
    async updateDashboardContent() {
        if (!this.dashboardPanel) {
            return;
        }
        const data = await this.collectDashboardData();
        const html = this.generateDashboardHTML(data);
        this.dashboardPanel.webview.html = html;
    }
    async handleWebviewMessage(message) {
        try {
            switch (message.type) {
                case 'requestData':
                    await this.sendDataUpdate();
                    break;
                case 'switchLayout':
                    await this.switchLayout(message.layoutId);
                    break;
                case 'saveLayout':
                    await this.saveLayout(message.layout);
                    break;
                case 'exportData':
                    await this.exportData(message.format);
                    break;
                case 'toggleStreaming':
                    if (this.isStreaming) {
                        this.stopRealTimeUpdates();
                    }
                    else {
                        await this.startRealTimeUpdates();
                    }
                    break;
                default:
                    this.outputChannel.appendLine(`Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'HANDLE_WEBVIEW_MESSAGE',
                    component: 'DashboardManager',
                    additionalData: { messageType: message.type }
                }, { severity: 'low' });
            }
        }
    }
    async startRealTimeUpdates() {
        if (this.isStreaming) {
            return;
        }
        this.isStreaming = true;
        // Start WebSocket streaming
        await this.webSocketServer.start();
        // Start data streaming
        this.dataStreamer.startStreaming(async () => {
            return await this.collectDashboardData();
        });
        // Setup periodic updates
        this.updateInterval = setInterval(async () => {
            await this.sendDataUpdate();
        }, 1000); // Update every second
        this.outputChannel.appendLine('🔄 Started real-time dashboard updates');
    }
    stopRealTimeUpdates() {
        if (!this.isStreaming) {
            return;
        }
        this.isStreaming = false;
        // Stop WebSocket streaming
        this.webSocketServer.stop();
        // Stop data streaming
        this.dataStreamer.stopStreaming();
        // Clear update interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
        this.outputChannel.appendLine('⏸️ Stopped real-time dashboard updates');
    }
    async sendDataUpdate() {
        if (!this.dashboardPanel) {
            return;
        }
        try {
            const data = await this.collectDashboardData();
            this.dashboardPanel.webview.postMessage({
                type: 'dataUpdate',
                data: data,
                timestamp: new Date().toISOString()
            });
            // Also send via WebSocket if available
            this.webSocketServer.broadcast({
                type: 'dashboardUpdate',
                data: data
            });
        }
        catch (error) {
            // Silently handle data collection errors to avoid spam
            console.error('Dashboard data update failed:', error);
        }
    }
    async collectDashboardData() {
        const swarmStatus = await this.swarmManager.getSwarmStatus();
        const fileWatcherMetrics = this.fileWatcher.getMetrics();
        return {
            timestamp: new Date(),
            swarmMetrics: {
                activeAgents: swarmStatus.activeAgents,
                totalTasks: swarmStatus.activeTasks + swarmStatus.completedTasks,
                completedTasks: swarmStatus.completedTasks,
                failedTasks: 0, // Would need to track this
                averageResponseTime: swarmStatus.performance.averageResponseTime,
                throughput: swarmStatus.performance.tasksPerSecond,
                errorRate: 1 - swarmStatus.performance.successRate
            },
            fileWatcherMetrics: {
                watchedFiles: fileWatcherMetrics.filesWatched,
                analysisQueue: fileWatcherMetrics.queueSize,
                activeAnalysis: fileWatcherMetrics.activeAnalysis,
                completedAnalysis: fileWatcherMetrics.analysisCompleted,
                errorCount: fileWatcherMetrics.analysisErrors,
                averageAnalysisTime: fileWatcherMetrics.averageAnalysisTime
            },
            systemMetrics: {
                cpuUsage: swarmStatus.performance.cpuUsage,
                memoryUsage: swarmStatus.performance.memoryUsage,
                diskUsage: 0, // Would need system monitoring
                networkActivity: 0 // Would need system monitoring
            },
            recentEvents: [] // Would be populated from event history
        };
    }
    generateDashboardHTML(data) {
        const webview = this.dashboardPanel.webview;
        // Get resource URIs
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dashboard.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'dashboard.css'));
        const chartJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'chart.min.js'));
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
            <title>RUV-Swarm Dashboard</title>
            <link href="${styleUri}" rel="stylesheet">
            <script src="${chartJsUri}"></script>
        </head>
        <body>
            <div id="dashboard-container">
                <header class="dashboard-header">
                    <h1>🧠 RUV-Swarm Dashboard</h1>
                    <div class="header-controls">
                        <select id="layout-selector">
                            ${this.getAvailableLayouts().map(layout => `<option value="${layout.id}" ${layout.id === this.currentLayout.id ? 'selected' : ''}>${layout.name}</option>`).join('')}
                        </select>
                        <button id="streaming-toggle" class="${this.isStreaming ? 'active' : ''}">${this.isStreaming ? '⏸️ Pause' : '▶️ Stream'}</button>
                        <button id="export-btn">📊 Export</button>
                        <button id="settings-btn">⚙️ Settings</button>
                    </div>
                </header>
                
                <main class="dashboard-main">
                    <div class="dashboard-grid" id="dashboard-grid">
                        ${this.renderPanels(data)}
                    </div>
                </main>
                
                <div id="status-bar" class="status-bar">
                    <span>Last Update: <span id="last-update">${data.timestamp.toLocaleTimeString()}</span></span>
                    <span>Status: <span id="connection-status" class="${this.isStreaming ? 'connected' : 'disconnected'}">${this.isStreaming ? 'Streaming' : 'Static'}</span></span>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let currentData = ${JSON.stringify(data)};
                
                // Initialize dashboard
                initializeDashboard();
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'dataUpdate':
                            currentData = message.data;
                            updateDashboard(message.data);
                            document.getElementById('last-update').textContent = new Date(message.timestamp).toLocaleTimeString();
                            break;
                    }
                });
                
                function initializeDashboard() {
                    // Setup event listeners
                    document.getElementById('layout-selector').addEventListener('change', (e) => {
                        vscode.postMessage({
                            type: 'switchLayout',
                            layoutId: e.target.value
                        });
                    });
                    
                    document.getElementById('streaming-toggle').addEventListener('click', () => {
                        vscode.postMessage({ type: 'toggleStreaming' });
                    });
                    
                    document.getElementById('export-btn').addEventListener('click', () => {
                        vscode.postMessage({
                            type: 'exportData',
                            format: 'json'
                        });
                    });
                    
                    // Initialize charts
                    initializeCharts();
                    
                    // Request initial data
                    vscode.postMessage({ type: 'requestData' });
                }
                
                function updateDashboard(data) {
                    updateMetrics(data);
                    updateCharts(data);
                    updateTables(data);
                }
                
                function updateMetrics(data) {
                    // Update metric displays
                    const metrics = [
                        { id: 'active-agents', value: data.swarmMetrics.activeAgents },
                        { id: 'total-tasks', value: data.swarmMetrics.totalTasks },
                        { id: 'completed-tasks', value: data.swarmMetrics.completedTasks },
                        { id: 'error-rate', value: (data.swarmMetrics.errorRate * 100).toFixed(1) + '%' },
                        { id: 'watched-files', value: data.fileWatcherMetrics.watchedFiles },
                        { id: 'analysis-queue', value: data.fileWatcherMetrics.analysisQueue },
                        { id: 'cpu-usage', value: data.systemMetrics.cpuUsage.toFixed(1) + '%' },
                        { id: 'memory-usage', value: data.systemMetrics.memoryUsage.toFixed(1) + '%' }
                    ];
                    
                    metrics.forEach(metric => {
                        const element = document.getElementById(metric.id);
                        if (element) {
                            element.textContent = metric.value;
                        }
                    });
                }
                
                function initializeCharts() {
                    // Initialize Chart.js charts
                    // This would contain the actual chart initialization code
                }
                
                function updateCharts(data) {
                    // Update Chart.js charts with new data
                    // This would contain the actual chart update code
                }
                
                function updateTables(data) {
                    // Update data tables
                    // This would contain the actual table update code
                }
            </script>
            <script src="${scriptUri}"></script>
        </body>
        </html>
        `;
    }
    renderPanels(data) {
        return this.currentLayout.panels
            .filter(panel => panel.visible)
            .map(panel => this.renderPanel(panel, data))
            .join('');
    }
    renderPanel(panel, data) {
        const style = `
            grid-column: ${panel.position.x + 1} / span ${panel.position.width};
            grid-row: ${panel.position.y + 1} / span ${panel.position.height};
        `;
        switch (panel.type) {
            case 'metrics':
                return this.renderMetricsPanel(panel, data, style);
            case 'chart':
                return this.renderChartPanel(panel, data, style);
            case 'table':
                return this.renderTablePanel(panel, data, style);
            case 'logs':
                return this.renderLogsPanel(panel, data, style);
            default:
                return `<div class="dashboard-panel" style="${style}"><h3>${panel.title}</h3><p>Unknown panel type</p></div>`;
        }
    }
    renderMetricsPanel(panel, data, style) {
        return `
        <div class="dashboard-panel metrics-panel" style="${style}">
            <h3>${panel.title}</h3>
            <div class="metrics-grid">
                <div class="metric">
                    <span class="metric-label">Active Agents</span>
                    <span class="metric-value" id="active-agents">${data.swarmMetrics.activeAgents}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Tasks</span>
                    <span class="metric-value" id="total-tasks">${data.swarmMetrics.totalTasks}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Completed</span>
                    <span class="metric-value" id="completed-tasks">${data.swarmMetrics.completedTasks}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Error Rate</span>
                    <span class="metric-value" id="error-rate">${(data.swarmMetrics.errorRate * 100).toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Watched Files</span>
                    <span class="metric-value" id="watched-files">${data.fileWatcherMetrics.watchedFiles}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Analysis Queue</span>
                    <span class="metric-value" id="analysis-queue">${data.fileWatcherMetrics.analysisQueue}</span>
                </div>
            </div>
        </div>
        `;
    }
    renderChartPanel(panel, data, style) {
        return `
        <div class="dashboard-panel chart-panel" style="${style}">
            <h3>${panel.title}</h3>
            <canvas id="chart-${panel.id}" width="400" height="200"></canvas>
        </div>
        `;
    }
    renderTablePanel(panel, data, style) {
        return `
        <div class="dashboard-panel table-panel" style="${style}">
            <h3>${panel.title}</h3>
            <div class="table-container">
                <table id="table-${panel.id}">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Event</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.recentEvents.map(event => `
                            <tr>
                                <td>${event.timestamp.toLocaleTimeString()}</td>
                                <td>${event.message}</td>
                                <td class="status-${event.severity}">${event.severity}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    }
    renderLogsPanel(panel, data, style) {
        return `
        <div class="dashboard-panel logs-panel" style="${style}">
            <h3>${panel.title}</h3>
            <div class="logs-container" id="logs-${panel.id}">
                ${data.recentEvents.map(event => `
                    <div class="log-entry log-${event.severity}">
                        <span class="log-time">${event.timestamp.toLocaleTimeString()}</span>
                        <span class="log-message">${event.message}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }
    createDefaultLayout() {
        return {
            id: 'default',
            name: 'Default Layout',
            isDefault: true,
            panels: [
                {
                    id: 'metrics-overview',
                    title: 'System Metrics',
                    type: 'metrics',
                    position: { x: 0, y: 0, width: 2, height: 1 },
                    config: {},
                    visible: true
                },
                {
                    id: 'performance-chart',
                    title: 'Performance Trends',
                    type: 'chart',
                    position: { x: 2, y: 0, width: 2, height: 2 },
                    config: { chartType: 'line' },
                    visible: true
                },
                {
                    id: 'recent-events',
                    title: 'Recent Events',
                    type: 'table',
                    position: { x: 0, y: 1, width: 2, height: 2 },
                    config: {},
                    visible: true
                },
                {
                    id: 'system-logs',
                    title: 'System Logs',
                    type: 'logs',
                    position: { x: 0, y: 3, width: 4, height: 1 },
                    config: {},
                    visible: true
                }
            ]
        };
    }
    setupEventListeners() {
        // Listen to swarm events
        this.swarmManager.onSwarmEvent((event) => {
            if (this.isStreaming) {
                this.sendDataUpdate();
            }
        });
        // Listen to error events
        this.errorHandler.onErrorEvent((event) => {
            if (this.isStreaming) {
                this.sendDataUpdate();
            }
        });
    }
    async loadSavedLayouts() {
        try {
            const savedLayouts = this.context.globalState.get('dashboardLayouts', []);
            for (const layout of savedLayouts) {
                this.availableLayouts.set(layout.id, layout);
            }
            this.outputChannel.appendLine(`📋 Loaded ${savedLayouts.length} saved layouts`);
        }
        catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to load saved layouts, using defaults');
        }
    }
    async persistLayouts() {
        try {
            const layouts = Array.from(this.availableLayouts.values());
            await this.context.globalState.update('dashboardLayouts', layouts);
        }
        catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to persist layouts');
        }
    }
    async writeDataToFile(data, uri, format) {
        let content;
        switch (format) {
            case 'json':
                content = JSON.stringify(data, null, 2);
                break;
            case 'csv':
                content = this.convertToCSV(data);
                break;
            case 'xlsx':
                // Would need a library like xlsx to implement this
                throw new Error('XLSX export not implemented yet');
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
    }
    convertToCSV(data) {
        const headers = [
            'Timestamp',
            'Active Agents',
            'Total Tasks',
            'Completed Tasks',
            'Error Rate',
            'Watched Files',
            'Analysis Queue',
            'CPU Usage',
            'Memory Usage'
        ];
        const row = [
            data.timestamp.toISOString(),
            data.swarmMetrics.activeAgents,
            data.swarmMetrics.totalTasks,
            data.swarmMetrics.completedTasks,
            data.swarmMetrics.errorRate,
            data.fileWatcherMetrics.watchedFiles,
            data.fileWatcherMetrics.analysisQueue,
            data.systemMetrics.cpuUsage,
            data.systemMetrics.memoryUsage
        ];
        return [headers.join(','), row.join(',')].join('\n');
    }
    dispose() {
        this.stopRealTimeUpdates();
        if (this.dashboardPanel) {
            this.dashboardPanel.dispose();
        }
        this.webSocketServer.dispose();
        this.dataStreamer.dispose();
        this.outputChannel.dispose();
    }
}
exports.DashboardManager = DashboardManager;
//# sourceMappingURL=dashboardManager.js.map