import * as vscode from 'vscode';
export interface ErrorReport {
    id: string;
    timestamp: Date;
    error: Error;
    context: ErrorContext;
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'cli' | 'swarm' | 'agent' | 'task' | 'validation' | 'network' | 'filesystem' | 'unknown';
    handled: boolean;
    userNotified: boolean;
    recoveryAttempted: boolean;
    recoverySuccessful?: boolean;
}
export interface ErrorContext {
    operation?: string;
    component?: string;
    filePath?: string;
    commandId?: string;
    agentId?: string;
    taskId?: string;
    userId?: string;
    workspaceFolder?: string;
    additionalData?: Record<string, any>;
}
export interface RecoveryStrategy {
    name: string;
    description: string;
    canRecover: (error: Error, context: ErrorContext) => boolean;
    recover: (error: Error, context: ErrorContext) => Promise<boolean>;
    priority: number;
}
export declare class ErrorHandler implements vscode.Disposable {
    private errorReports;
    private recoveryStrategies;
    private outputChannel;
    private eventEmitter;
    private maxReports;
    readonly onErrorEvent: vscode.Event<{
        type: string;
        report: ErrorReport;
    }>;
    constructor();
    handleError(error: Error, context?: ErrorContext, options?: {
        showToUser?: boolean;
        attemptRecovery?: boolean;
        severity?: ErrorReport['severity'];
    }): Promise<ErrorReport>;
    registerRecoveryStrategy(strategy: RecoveryStrategy): void;
    attemptRecovery(errorReport: ErrorReport): Promise<boolean>;
    private notifyUser;
    private handleUserAction;
    private retryOperation;
    private showErrorDetails;
    private reportIssue;
    private disableFeature;
    private determineSeverity;
    private categorizeError;
    private shouldNotifyUser;
    private formatUserMessage;
    private getErrorActions;
    private formatErrorDetails;
    private generateIssueUrl;
    private logError;
    private cleanupOldReports;
    private initializeRecoveryStrategies;
    getErrorReports(): ErrorReport[];
    getErrorReport(id: string): ErrorReport | undefined;
    clearErrorReports(): void;
    dispose(): void;
}
//# sourceMappingURL=errorHandler.d.ts.map