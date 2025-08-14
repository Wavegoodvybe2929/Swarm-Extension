import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { AdvancedFileWatcher } from '../watchers/advancedFileWatcher';
import { ErrorHandler } from '../utils/errorHandler';
export interface DashboardPanel {
    id: string;
    title: string;
    type: 'chart' | 'table' | 'metrics' | 'logs' | 'custom';
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    config: any;
    visible: boolean;
}
export interface DashboardLayout {
    id: string;
    name: string;
    panels: DashboardPanel[];
    isDefault: boolean;
}
export interface DashboardData {
    timestamp: Date;
    swarmMetrics: {
        activeAgents: number;
        totalTasks: number;
        completedTasks: number;
        failedTasks: number;
        averageResponseTime: number;
        throughput: number;
        errorRate: number;
    };
    fileWatcherMetrics: {
        watchedFiles: number;
        analysisQueue: number;
        activeAnalysis: number;
        completedAnalysis: number;
        errorCount: number;
        averageAnalysisTime: number;
    };
    systemMetrics: {
        cpuUsage: number;
        memoryUsage: number;
        diskUsage: number;
        networkActivity: number;
    };
    recentEvents: Array<{
        timestamp: Date;
        type: string;
        message: string;
        severity: 'info' | 'warning' | 'error';
    }>;
}
export declare class DashboardManager implements vscode.Disposable {
    private context;
    private swarmManager;
    private fileWatcher;
    private errorHandler;
    private webSocketServer;
    private dataStreamer;
    private dashboardPanel?;
    private currentLayout;
    private availableLayouts;
    private updateInterval?;
    private isStreaming;
    private readonly outputChannel;
    constructor(context: vscode.ExtensionContext, swarmManager: SwarmManager, fileWatcher: AdvancedFileWatcher, errorHandler: ErrorHandler);
    initialize(): Promise<void>;
    showDashboard(layoutId?: string): Promise<void>;
    switchLayout(layoutId: string): Promise<void>;
    saveLayout(layout: DashboardLayout): Promise<void>;
    deleteLayout(layoutId: string): Promise<void>;
    getAvailableLayouts(): DashboardLayout[];
    exportData(format: 'json' | 'csv' | 'xlsx'): Promise<void>;
    private createDashboardPanel;
    private updateDashboardContent;
    private handleWebviewMessage;
    private startRealTimeUpdates;
    private stopRealTimeUpdates;
    private sendDataUpdate;
    private collectDashboardData;
    private generateDashboardHTML;
    private renderPanels;
    private renderPanel;
    private renderMetricsPanel;
    private renderChartPanel;
    private renderTablePanel;
    private renderLogsPanel;
    private createDefaultLayout;
    private setupEventListeners;
    private loadSavedLayouts;
    private persistLayouts;
    private writeDataToFile;
    private convertToCSV;
    dispose(): void;
}
//# sourceMappingURL=dashboardManager.d.ts.map