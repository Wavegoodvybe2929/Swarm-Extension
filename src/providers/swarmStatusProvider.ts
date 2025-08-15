import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { SwarmStatus } from '../types';

export class SwarmStatusProvider implements vscode.TreeDataProvider<SwarmStatusItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SwarmStatusItem | undefined | null | void> = new vscode.EventEmitter<SwarmStatusItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<SwarmStatusItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private swarmManager: SwarmManager) {
        // Listen to swarm events to refresh the tree
        this.swarmManager.onSwarmEvent(() => {
            this.refresh();
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SwarmStatusItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SwarmStatusItem): Promise<SwarmStatusItem[]> {
        if (!element) {
            // Root level items
            const status = await this.swarmManager.getSwarmStatus();
            return [
                new SwarmStatusItem(
                    'Overview',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'overview',
                    status
                ),
                new SwarmStatusItem(
                    'Performance',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'performance',
                    status
                ),
                new SwarmStatusItem(
                    'Health',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'health',
                    status
                )
            ];
        } else {
            // Child items based on category
            return this.getChildItems(element);
        }
    }

    private getChildItems(element: SwarmStatusItem): SwarmStatusItem[] {
        const status = element.status;
        
        switch (element.category) {
            case 'overview':
                return [
                    new SwarmStatusItem(
                        `Topology: ${status.topology}`,
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        status,
                        '$(organization)'
                    ),
                    new SwarmStatusItem(
                        `Active Agents: ${status.activeAgents}/${status.totalAgents}`,
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        status,
                        '$(person)'
                    ),
                    new SwarmStatusItem(
                        `Active Tasks: ${status.activeTasks}`,
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        status,
                        '$(play)'
                    ),
                    new SwarmStatusItem(
                        `Completed Tasks: ${status.completedTasks}`,
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        status,
                        '$(check)'
                    )
                ];

            case 'performance':
                return [
                    new SwarmStatusItem(
                        `Tasks/Second: ${status.performance.tasksPerSecond.toFixed(2)}`,
                        vscode.TreeItemCollapsibleState.None,
                        'metric',
                        status,
                        '$(dashboard)'
                    ),
                    new SwarmStatusItem(
                        `Avg Response: ${status.performance.averageResponseTime.toFixed(0)}ms`,
                        vscode.TreeItemCollapsibleState.None,
                        'metric',
                        status,
                        '$(clock)'
                    ),
                    new SwarmStatusItem(
                        `Success Rate: ${(status.performance.successRate * 100).toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        'metric',
                        status,
                        '$(pass)'
                    ),
                    new SwarmStatusItem(
                        `Token Efficiency: ${(status.performance.tokenEfficiency * 100).toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        'metric',
                        status,
                        '$(symbol-misc)'
                    ),
                    new SwarmStatusItem(
                        `CPU Usage: ${status.performance.cpuUsage.toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        'metric',
                        status,
                        '$(pulse)'
                    ),
                    new SwarmStatusItem(
                        `Memory Usage: ${status.performance.memoryUsage.toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        'metric',
                        status,
                        '$(database)'
                    )
                ];

            case 'health':
                const healthIcon = this.getHealthIcon(status.health.status);
                const items = [
                    new SwarmStatusItem(
                        `Status: ${status.health.status}`,
                        vscode.TreeItemCollapsibleState.None,
                        'health',
                        status,
                        healthIcon
                    ),
                    new SwarmStatusItem(
                        `Last Check: ${status.health.lastHealthCheck.toLocaleTimeString()}`,
                        vscode.TreeItemCollapsibleState.None,
                        'health',
                        status,
                        '$(history)'
                    )
                ];

                // Add issues if any
                if (status.health.issues.length > 0) {
                    items.push(
                        new SwarmStatusItem(
                            'Issues',
                            vscode.TreeItemCollapsibleState.Expanded,
                            'issues',
                            status,
                            '$(warning)'
                        )
                    );
                }

                return items;

            case 'issues':
                return status.health.issues.map((issue, index) => 
                    new SwarmStatusItem(
                        issue,
                        vscode.TreeItemCollapsibleState.None,
                        'issue',
                        status,
                        '$(error)'
                    )
                );

            default:
                return [];
        }
    }

    private getHealthIcon(healthStatus: string): string {
        switch (healthStatus) {
            case 'healthy': return '$(pass-filled)';
            case 'degraded': return '$(warning)';
            case 'critical': return '$(error)';
            case 'offline': return '$(circle-slash)';
            default: return '$(question)';
        }
    }
}

class SwarmStatusItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly category: string,
        public readonly status: SwarmStatus,
        public readonly iconName?: string
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.getTooltip();
        this.contextValue = category;
        
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName.replace('$(', '').replace(')', ''));
        }
    }

    private getTooltip(): string {
        switch (this.category) {
            case 'overview':
                return 'Swarm overview information';
            case 'performance':
                return 'Performance metrics and statistics';
            case 'health':
                return 'Swarm health status and diagnostics';
            case 'info':
                return `${this.label} - Current swarm information`;
            case 'metric':
                return `${this.label} - Performance metric`;
            case 'issue':
                return `Issue: ${this.label}`;
            default:
                return this.label;
        }
    }
}
