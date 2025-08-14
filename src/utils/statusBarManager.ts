import * as vscode from 'vscode';

export interface StatusBarMetrics {
    activeAgents: number;
    queuedCommands: number;
    runningTasks: number;
    errorCount: number;
    lastActivity?: Date;
}

export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private metricsItem: vscode.StatusBarItem;
    private currentStatus: string = 'offline';
    private metrics: StatusBarMetrics = {
        activeAgents: 0,
        queuedCommands: 0,
        runningTasks: 0,
        errorCount: 0
    };

    constructor() {
        // Main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        
        // Metrics status bar item
        this.metricsItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        
        this.statusBarItem.command = 'ruv-swarm.openDashboard';
        this.metricsItem.command = 'ruv-swarm.showCommandQueue';
        
        this.statusBarItem.show();
        this.updateStatus('offline', 'RUV-Swarm Offline');
    }

    updateStatus(status: string, text: string, metrics?: Partial<StatusBarMetrics>): void {
        this.currentStatus = status;
        
        if (metrics) {
            this.metrics = { ...this.metrics, ...metrics };
        }

        this.statusBarItem.text = `$(brain) ${text}`;
        
        // Update tooltip and color based on status
        const tooltip = this.generateTooltip(status);
        this.statusBarItem.tooltip = tooltip;
        
        switch (status) {
            case 'ready':
                this.statusBarItem.backgroundColor = undefined;
                break;
            case 'initializing':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
                break;
            case 'busy':
            case 'analyzing':
            case 'generating':
            case 'reviewing':
            case 'optimizing':
            case 'scanning':
            case 'explaining':
            case 'refactoring':
            case 'benchmarking':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
                break;
            case 'error':
                this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
                break;
            case 'offline':
            default:
                this.statusBarItem.backgroundColor = undefined;
                break;
        }

        this.updateMetricsDisplay();
    }

    updateMetrics(metrics: Partial<StatusBarMetrics>): void {
        this.metrics = { ...this.metrics, ...metrics, lastActivity: new Date() };
        this.updateMetricsDisplay();
    }

    private updateMetricsDisplay(): void {
        const hasActivity = this.metrics.activeAgents > 0 || 
                           this.metrics.queuedCommands > 0 || 
                           this.metrics.runningTasks > 0;

        if (hasActivity || this.metrics.errorCount > 0) {
            let metricsText = '';
            const parts: string[] = [];

            if (this.metrics.activeAgents > 0) {
                parts.push(`$(person) ${this.metrics.activeAgents}`);
            }

            if (this.metrics.queuedCommands > 0) {
                parts.push(`$(list-ordered) ${this.metrics.queuedCommands}`);
            }

            if (this.metrics.runningTasks > 0) {
                parts.push(`$(loading~spin) ${this.metrics.runningTasks}`);
            }

            if (this.metrics.errorCount > 0) {
                parts.push(`$(error) ${this.metrics.errorCount}`);
            }

            metricsText = parts.join(' ');
            
            this.metricsItem.text = metricsText;
            this.metricsItem.tooltip = this.generateMetricsTooltip();
            this.metricsItem.show();
        } else {
            this.metricsItem.hide();
        }
    }

    private generateTooltip(status: string): string {
        const baseTooltip = this.getBaseTooltip(status);
        const metricsInfo = this.getMetricsInfo();
        
        return metricsInfo ? `${baseTooltip}\n\n${metricsInfo}` : baseTooltip;
    }

    private getBaseTooltip(status: string): string {
        switch (status) {
            case 'ready':
                return 'RUV-Swarm is ready. Click to open dashboard.';
            case 'initializing':
                return 'RUV-Swarm is initializing...';
            case 'busy':
            case 'analyzing':
            case 'generating':
            case 'reviewing':
            case 'optimizing':
            case 'scanning':
            case 'explaining':
            case 'refactoring':
            case 'benchmarking':
                return `RUV-Swarm is ${status}...`;
            case 'error':
                return 'RUV-Swarm encountered an error. Click for details.';
            case 'offline':
            default:
                return 'RUV-Swarm is offline. Click to initialize.';
        }
    }

    private getMetricsInfo(): string {
        const info: string[] = [];
        
        if (this.metrics.activeAgents > 0) {
            info.push(`Active Agents: ${this.metrics.activeAgents}`);
        }
        
        if (this.metrics.queuedCommands > 0) {
            info.push(`Queued Commands: ${this.metrics.queuedCommands}`);
        }
        
        if (this.metrics.runningTasks > 0) {
            info.push(`Running Tasks: ${this.metrics.runningTasks}`);
        }
        
        if (this.metrics.errorCount > 0) {
            info.push(`Errors: ${this.metrics.errorCount}`);
        }
        
        if (this.metrics.lastActivity) {
            const timeSince = Date.now() - this.metrics.lastActivity.getTime();
            const minutes = Math.floor(timeSince / 60000);
            if (minutes < 60) {
                info.push(`Last Activity: ${minutes}m ago`);
            } else {
                const hours = Math.floor(minutes / 60);
                info.push(`Last Activity: ${hours}h ago`);
            }
        }
        
        return info.join('\n');
    }

    private generateMetricsTooltip(): string {
        const parts: string[] = [];
        
        if (this.metrics.activeAgents > 0) {
            parts.push(`${this.metrics.activeAgents} active agent${this.metrics.activeAgents > 1 ? 's' : ''}`);
        }
        
        if (this.metrics.queuedCommands > 0) {
            parts.push(`${this.metrics.queuedCommands} queued command${this.metrics.queuedCommands > 1 ? 's' : ''}`);
        }
        
        if (this.metrics.runningTasks > 0) {
            parts.push(`${this.metrics.runningTasks} running task${this.metrics.runningTasks > 1 ? 's' : ''}`);
        }
        
        if (this.metrics.errorCount > 0) {
            parts.push(`${this.metrics.errorCount} error${this.metrics.errorCount > 1 ? 's' : ''}`);
        }
        
        const tooltip = parts.join(', ');
        return `RUV-Swarm Metrics: ${tooltip}\nClick to view command queue`;
    }

    showProgress(message: string, progress?: number): void {
        let text = message;
        if (progress !== undefined) {
            text += ` (${Math.round(progress)}%)`;
        }
        
        this.updateStatus('busy', text);
    }

    showError(message: string, errorCount?: number): void {
        if (errorCount !== undefined) {
            this.updateMetrics({ errorCount });
        }
        
        this.updateStatus('error', message);
    }

    clearError(): void {
        this.updateMetrics({ errorCount: 0 });
        
        if (this.currentStatus === 'error') {
            this.updateStatus('ready', 'RUV-Swarm Ready');
        }
    }

    incrementErrorCount(): void {
        this.updateMetrics({ errorCount: this.metrics.errorCount + 1 });
    }

    getMetrics(): StatusBarMetrics {
        return { ...this.metrics };
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.metricsItem.dispose();
    }
}
