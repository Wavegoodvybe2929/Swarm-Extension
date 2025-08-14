import * as vscode from 'vscode';
export interface StatusBarMetrics {
    activeAgents: number;
    queuedCommands: number;
    runningTasks: number;
    errorCount: number;
    lastActivity?: Date;
}
export declare class StatusBarManager implements vscode.Disposable {
    private statusBarItem;
    private metricsItem;
    private currentStatus;
    private metrics;
    constructor();
    updateStatus(status: string, text: string, metrics?: Partial<StatusBarMetrics>): void;
    updateMetrics(metrics: Partial<StatusBarMetrics>): void;
    private updateMetricsDisplay;
    private generateTooltip;
    private getBaseTooltip;
    private getMetricsInfo;
    private generateMetricsTooltip;
    showProgress(message: string, progress?: number): void;
    showError(message: string, errorCount?: number): void;
    clearError(): void;
    incrementErrorCount(): void;
    getMetrics(): StatusBarMetrics;
    dispose(): void;
}
//# sourceMappingURL=statusBarManager.d.ts.map