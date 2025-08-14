import * as vscode from 'vscode';
import { SwarmError, AgentError, TaskError } from '../types';

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
    priority: number; // Lower number = higher priority
}

export class ErrorHandler implements vscode.Disposable {
    private errorReports: Map<string, ErrorReport> = new Map();
    private recoveryStrategies: RecoveryStrategy[] = [];
    private outputChannel: vscode.OutputChannel;
    private eventEmitter = new vscode.EventEmitter<{ type: string; report: ErrorReport }>();
    private maxReports = 100; // Keep last 100 error reports

    public readonly onErrorEvent = this.eventEmitter.event;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Error Handler');
        this.initializeRecoveryStrategies();
    }

    async handleError(
        error: Error,
        context: ErrorContext = {},
        options?: {
            showToUser?: boolean;
            attemptRecovery?: boolean;
            severity?: ErrorReport['severity'];
        }
    ): Promise<ErrorReport> {
        const errorReport: ErrorReport = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            error,
            context,
            severity: options?.severity || this.determineSeverity(error, context),
            category: this.categorizeError(error, context),
            handled: false,
            userNotified: false,
            recoveryAttempted: false
        };

        // Store the error report
        this.errorReports.set(errorReport.id, errorReport);
        this.cleanupOldReports();

        // Log the error
        this.logError(errorReport);

        // Emit error event
        this.eventEmitter.fire({ type: 'error', report: errorReport });

        try {
            // Attempt recovery if requested
            if (options?.attemptRecovery !== false) {
                await this.attemptRecovery(errorReport);
            }

            // Notify user if requested or if severity is high
            if (options?.showToUser !== false && this.shouldNotifyUser(errorReport)) {
                await this.notifyUser(errorReport);
            }

            errorReport.handled = true;

        } catch (handlingError) {
            this.outputChannel.appendLine(`❌ Error occurred while handling error: ${handlingError}`);
        }

        return errorReport;
    }

    registerRecoveryStrategy(strategy: RecoveryStrategy): void {
        this.recoveryStrategies.push(strategy);
        this.recoveryStrategies.sort((a, b) => a.priority - b.priority);
        
        this.outputChannel.appendLine(`📋 Registered recovery strategy: ${strategy.name}`);
    }

    async attemptRecovery(errorReport: ErrorReport): Promise<boolean> {
        errorReport.recoveryAttempted = true;
        
        this.outputChannel.appendLine(`🔧 Attempting recovery for error: ${errorReport.error.message}`);

        for (const strategy of this.recoveryStrategies) {
            try {
                if (strategy.canRecover(errorReport.error, errorReport.context)) {
                    this.outputChannel.appendLine(`   Trying strategy: ${strategy.name}`);
                    
                    const recovered = await strategy.recover(errorReport.error, errorReport.context);
                    
                    if (recovered) {
                        errorReport.recoverySuccessful = true;
                        this.outputChannel.appendLine(`✅ Recovery successful using strategy: ${strategy.name}`);
                        this.eventEmitter.fire({ type: 'recovered', report: errorReport });
                        return true;
                    }
                }
            } catch (recoveryError) {
                this.outputChannel.appendLine(`   Recovery strategy failed: ${strategy.name} - ${recoveryError}`);
            }
        }

        errorReport.recoverySuccessful = false;
        this.outputChannel.appendLine(`❌ All recovery strategies failed for error: ${errorReport.error.message}`);
        return false;
    }

    private async notifyUser(errorReport: ErrorReport): Promise<void> {
        errorReport.userNotified = true;
        
        const message = this.formatUserMessage(errorReport);
        const actions = this.getErrorActions(errorReport);

        let selectedAction: string | undefined;

        switch (errorReport.severity) {
            case 'critical':
                selectedAction = await vscode.window.showErrorMessage(message, ...actions);
                break;
            case 'high':
                selectedAction = await vscode.window.showErrorMessage(message, ...actions);
                break;
            case 'medium':
                selectedAction = await vscode.window.showWarningMessage(message, ...actions);
                break;
            case 'low':
                selectedAction = await vscode.window.showInformationMessage(message, ...actions);
                break;
        }

        if (selectedAction) {
            await this.handleUserAction(selectedAction, errorReport);
        }
    }

    private async handleUserAction(action: string, errorReport: ErrorReport): Promise<void> {
        switch (action) {
            case 'Retry':
                await this.retryOperation(errorReport);
                break;
            case 'Show Details':
                this.showErrorDetails(errorReport);
                break;
            case 'Report Issue':
                this.reportIssue(errorReport);
                break;
            case 'Ignore':
                // Do nothing
                break;
            case 'Disable Feature':
                await this.disableFeature(errorReport);
                break;
        }
    }

    private async retryOperation(errorReport: ErrorReport): Promise<void> {
        // This would need to be implemented based on the specific operation
        this.outputChannel.appendLine(`🔄 User requested retry for: ${errorReport.context.operation}`);
        
        // Emit retry event for other components to handle
        this.eventEmitter.fire({ type: 'retry', report: errorReport });
    }

    private showErrorDetails(errorReport: ErrorReport): void {
        const details = this.formatErrorDetails(errorReport);
        
        const outputChannel = vscode.window.createOutputChannel(`RUV-Swarm Error Details - ${errorReport.id}`);
        outputChannel.clear();
        outputChannel.appendLine(details);
        outputChannel.show();
    }

    private reportIssue(errorReport: ErrorReport): void {
        const issueUrl = this.generateIssueUrl(errorReport);
        vscode.env.openExternal(vscode.Uri.parse(issueUrl));
    }

    private async disableFeature(errorReport: ErrorReport): Promise<void> {
        // This would disable the feature that caused the error
        this.outputChannel.appendLine(`⚠️ User requested to disable feature related to: ${errorReport.context.component}`);
        
        // Emit disable event for other components to handle
        this.eventEmitter.fire({ type: 'disable', report: errorReport });
    }

    private determineSeverity(error: Error, context: ErrorContext): ErrorReport['severity'] {
        // Critical errors
        if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
            return 'critical';
        }
        
        if (error instanceof SwarmError && error.code === 'INIT_FAILED') {
            return 'critical';
        }

        // High severity errors
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
            return 'high';
        }
        
        if (error instanceof AgentError || error instanceof TaskError) {
            return 'high';
        }

        // Medium severity errors
        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            return 'medium';
        }

        if (error.message.includes('validation')) {
            return 'medium';
        }

        // Default to low
        return 'low';
    }

    private categorizeError(error: Error, context: ErrorContext): ErrorReport['category'] {
        if (error instanceof SwarmError) {
            return 'swarm';
        }
        
        if (error instanceof AgentError) {
            return 'agent';
        }
        
        if (error instanceof TaskError) {
            return 'task';
        }

        if (error.message.includes('CLI') || error.message.includes('command')) {
            return 'cli';
        }

        if (error.message.includes('validation')) {
            return 'validation';
        }

        if (error.message.includes('ENOENT') || error.message.includes('EACCES')) {
            return 'filesystem';
        }

        if (error.message.includes('timeout') || error.message.includes('network')) {
            return 'network';
        }

        return 'unknown';
    }

    private shouldNotifyUser(errorReport: ErrorReport): boolean {
        // Always notify for critical and high severity errors
        if (errorReport.severity === 'critical' || errorReport.severity === 'high') {
            return true;
        }

        // Notify for medium severity if recovery failed
        if (errorReport.severity === 'medium' && errorReport.recoverySuccessful === false) {
            return true;
        }

        // Don't notify for low severity errors
        return false;
    }

    private formatUserMessage(errorReport: ErrorReport): string {
        const operation = errorReport.context.operation || 'operation';
        
        switch (errorReport.severity) {
            case 'critical':
                return `🚨 Critical error in RUV-Swarm ${operation}: ${errorReport.error.message}`;
            case 'high':
                return `❌ RUV-Swarm ${operation} failed: ${errorReport.error.message}`;
            case 'medium':
                return `⚠️ RUV-Swarm ${operation} encountered an issue: ${errorReport.error.message}`;
            case 'low':
                return `ℹ️ RUV-Swarm ${operation} completed with warnings: ${errorReport.error.message}`;
        }
    }

    private getErrorActions(errorReport: ErrorReport): string[] {
        const actions: string[] = [];

        // Always offer to show details
        actions.push('Show Details');

        // Offer retry for recoverable errors
        if (errorReport.category !== 'validation' && errorReport.severity !== 'low') {
            actions.push('Retry');
        }

        // Offer to report issue for high/critical errors
        if (errorReport.severity === 'critical' || errorReport.severity === 'high') {
            actions.push('Report Issue');
        }

        // Offer to disable feature for persistent errors
        if (errorReport.context.component) {
            actions.push('Disable Feature');
        }

        // Always offer ignore option
        actions.push('Ignore');

        return actions;
    }

    private formatErrorDetails(errorReport: ErrorReport): string {
        return `
RUV-Swarm Error Report
=====================

ID: ${errorReport.id}
Timestamp: ${errorReport.timestamp.toISOString()}
Severity: ${errorReport.severity}
Category: ${errorReport.category}

Error Details:
--------------
Message: ${errorReport.error.message}
Name: ${errorReport.error.name}
Stack: ${errorReport.error.stack || 'No stack trace available'}

Context:
--------
Operation: ${errorReport.context.operation || 'Unknown'}
Component: ${errorReport.context.component || 'Unknown'}
File Path: ${errorReport.context.filePath || 'N/A'}
Command ID: ${errorReport.context.commandId || 'N/A'}
Agent ID: ${errorReport.context.agentId || 'N/A'}
Task ID: ${errorReport.context.taskId || 'N/A'}
Workspace: ${errorReport.context.workspaceFolder || 'N/A'}

Recovery:
---------
Recovery Attempted: ${errorReport.recoveryAttempted}
Recovery Successful: ${errorReport.recoverySuccessful ?? 'N/A'}

Additional Data:
---------------
${errorReport.context.additionalData ? JSON.stringify(errorReport.context.additionalData, null, 2) : 'None'}
        `.trim();
    }

    private generateIssueUrl(errorReport: ErrorReport): string {
        const title = encodeURIComponent(`[Error] ${errorReport.error.message}`);
        const body = encodeURIComponent(`
**Error Report ID:** ${errorReport.id}
**Severity:** ${errorReport.severity}
**Category:** ${errorReport.category}

**Description:**
${errorReport.error.message}

**Context:**
- Operation: ${errorReport.context.operation || 'Unknown'}
- Component: ${errorReport.context.component || 'Unknown'}
- File Path: ${errorReport.context.filePath || 'N/A'}

**Stack Trace:**
\`\`\`
${errorReport.error.stack || 'No stack trace available'}
\`\`\`

**Additional Information:**
Please provide any additional context about what you were doing when this error occurred.
        `);

        return `https://github.com/ruvnet/ruv-FANN/issues/new?title=${title}&body=${body}&labels=bug,vscode-extension`;
    }

    private logError(errorReport: ErrorReport): void {
        const severityIcon = {
            'critical': '🚨',
            'high': '❌',
            'medium': '⚠️',
            'low': 'ℹ️'
        }[errorReport.severity];

        this.outputChannel.appendLine(`${severityIcon} [${errorReport.severity.toUpperCase()}] ${errorReport.error.message}`);
        this.outputChannel.appendLine(`   ID: ${errorReport.id}`);
        this.outputChannel.appendLine(`   Category: ${errorReport.category}`);
        this.outputChannel.appendLine(`   Operation: ${errorReport.context.operation || 'Unknown'}`);
        this.outputChannel.appendLine(`   Component: ${errorReport.context.component || 'Unknown'}`);
        
        if (errorReport.error.stack) {
            this.outputChannel.appendLine(`   Stack: ${errorReport.error.stack}`);
        }
    }

    private cleanupOldReports(): void {
        if (this.errorReports.size > this.maxReports) {
            const sortedReports = Array.from(this.errorReports.entries())
                .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime());
            
            const toDelete = sortedReports.slice(0, this.errorReports.size - this.maxReports);
            
            for (const [id] of toDelete) {
                this.errorReports.delete(id);
            }
        }
    }

    private initializeRecoveryStrategies(): void {
        // CLI not found recovery
        this.registerRecoveryStrategy({
            name: 'CLI Installation',
            description: 'Attempt to install ruv-swarm CLI',
            priority: 1,
            canRecover: (error, context) => {
                return error.message.includes('ruv-swarm') && 
                       (error.message.includes('not found') || error.message.includes('command not found'));
            },
            recover: async (error, context) => {
                try {
                    const choice = await vscode.window.showInformationMessage(
                        'RUV-Swarm CLI not found. Would you like to install it?',
                        'Install Globally',
                        'Install Locally',
                        'Cancel'
                    );

                    if (choice === 'Install Globally') {
                        const terminal = vscode.window.createTerminal('RUV-Swarm Installation');
                        terminal.sendText('npm install -g ruv-swarm');
                        terminal.show();
                        return true;
                    } else if (choice === 'Install Locally') {
                        const terminal = vscode.window.createTerminal('RUV-Swarm Installation');
                        terminal.sendText('npm install ruv-swarm');
                        terminal.show();
                        return true;
                    }
                } catch {
                    // Installation failed
                }
                return false;
            }
        });

        // Permission error recovery
        this.registerRecoveryStrategy({
            name: 'Permission Fix',
            description: 'Suggest permission fixes',
            priority: 2,
            canRecover: (error, context) => {
                return error.message.includes('EACCES') || error.message.includes('permission denied');
            },
            recover: async (error, context) => {
                const choice = await vscode.window.showErrorMessage(
                    'Permission denied. This might be a file system permission issue.',
                    'Open Workspace as Admin',
                    'Check Permissions',
                    'Cancel'
                );

                if (choice === 'Check Permissions') {
                    vscode.env.openExternal(vscode.Uri.parse('https://docs.microsoft.com/en-us/windows/security/identity-protection/user-account-control/'));
                    return true;
                }

                return false;
            }
        });

        // Timeout recovery
        this.registerRecoveryStrategy({
            name: 'Timeout Retry',
            description: 'Retry operation with longer timeout',
            priority: 3,
            canRecover: (error, context) => {
                return error.message.includes('timeout') || error.message.includes('ETIMEDOUT');
            },
            recover: async (error, context) => {
                // This would need to be implemented by the calling component
                return false; // Let the component handle the retry
            }
        });
    }

    getErrorReports(): ErrorReport[] {
        return Array.from(this.errorReports.values())
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getErrorReport(id: string): ErrorReport | undefined {
        return this.errorReports.get(id);
    }

    clearErrorReports(): void {
        this.errorReports.clear();
        this.outputChannel.appendLine('🗑️ Cleared all error reports');
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.eventEmitter.dispose();
        this.errorReports.clear();
        this.recoveryStrategies = [];
    }
}
