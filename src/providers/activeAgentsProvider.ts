import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { Agent } from '../types';

export class ActiveAgentsProvider implements vscode.TreeDataProvider<AgentItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AgentItem | undefined | null | void> = new vscode.EventEmitter<AgentItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AgentItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private swarmManager: SwarmManager) {
        // Listen to swarm events to refresh the tree
        this.swarmManager.onSwarmEvent((event) => {
            if (event.type === 'agent.spawned' || event.type === 'agent.terminated' || event.type === 'swarm.initialized') {
                this.refresh();
            }
        });
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AgentItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AgentItem): Promise<AgentItem[]> {
        if (!element) {
            // Root level - show all agents
            const agents = this.swarmManager.getAgents();
            
            if (agents.length === 0) {
                return [
                    new AgentItem(
                        'No agents spawned',
                        vscode.TreeItemCollapsibleState.None,
                        'empty',
                        undefined,
                        '$(info)'
                    )
                ];
            }

            return agents.map(agent => 
                new AgentItem(
                    agent.name,
                    vscode.TreeItemCollapsibleState.Expanded,
                    'agent',
                    agent,
                    this.getAgentIcon(agent.status)
                )
            );
        } else if (element.category === 'agent' && element.agent) {
            // Show agent details
            const agent = element.agent;
            return [
                new AgentItem(
                    `Type: ${agent.type}`,
                    vscode.TreeItemCollapsibleState.None,
                    'info',
                    agent,
                    '$(tag)'
                ),
                new AgentItem(
                    `Model: ${agent.model}`,
                    vscode.TreeItemCollapsibleState.None,
                    'info',
                    agent,
                    '$(circuit-board)'
                ),
                new AgentItem(
                    `Status: ${agent.status}`,
                    vscode.TreeItemCollapsibleState.None,
                    'status',
                    agent,
                    this.getAgentIcon(agent.status)
                ),
                new AgentItem(
                    `Pattern: ${agent.cognitivePattern}`,
                    vscode.TreeItemCollapsibleState.None,
                    'info',
                    agent,
                    '$(symbol-misc)'
                ),
                new AgentItem(
                    'Performance',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'performance',
                    agent,
                    '$(graph)'
                ),
                new AgentItem(
                    'Capabilities',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'capabilities',
                    agent,
                    '$(tools)'
                ),
                new AgentItem(
                    `Created: ${agent.createdAt.toLocaleString()}`,
                    vscode.TreeItemCollapsibleState.None,
                    'info',
                    agent,
                    '$(calendar)'
                ),
                new AgentItem(
                    `Last Active: ${agent.lastActive.toLocaleString()}`,
                    vscode.TreeItemCollapsibleState.None,
                    'info',
                    agent,
                    '$(clock)'
                )
            ];
        } else if (element.category === 'performance' && element.agent) {
            // Show performance metrics
            const perf = element.agent.performance;
            return [
                new AgentItem(
                    `Tasks Completed: ${perf.tasksCompleted}`,
                    vscode.TreeItemCollapsibleState.None,
                    'metric',
                    element.agent,
                    '$(check)'
                ),
                new AgentItem(
                    `Success Rate: ${(perf.successRate * 100).toFixed(1)}%`,
                    vscode.TreeItemCollapsibleState.None,
                    'metric',
                    element.agent,
                    '$(pass)'
                ),
                new AgentItem(
                    `Avg Response: ${perf.averageResponseTime.toFixed(0)}ms`,
                    vscode.TreeItemCollapsibleState.None,
                    'metric',
                    element.agent,
                    '$(dashboard)'
                ),
                new AgentItem(
                    `Token Efficiency: ${(perf.tokenEfficiency * 100).toFixed(1)}%`,
                    vscode.TreeItemCollapsibleState.None,
                    'metric',
                    element.agent,
                    '$(symbol-misc)'
                ),
                new AgentItem(
                    `Accuracy: ${(perf.accuracy * 100).toFixed(1)}%`,
                    vscode.TreeItemCollapsibleState.None,
                    'metric',
                    element.agent,
                    '$(target)'
                )
            ];
        } else if (element.category === 'capabilities' && element.agent) {
            // Show capabilities
            const capabilities = element.agent.capabilities;
            
            if (capabilities.length === 0) {
                return [
                    new AgentItem(
                        'No specific capabilities',
                        vscode.TreeItemCollapsibleState.None,
                        'info',
                        element.agent,
                        '$(info)'
                    )
                ];
            }

            return capabilities.map(capability => 
                new AgentItem(
                    capability,
                    vscode.TreeItemCollapsibleState.None,
                    'capability',
                    element.agent,
                    '$(gear)'
                )
            );
        }

        return [];
    }

    private getAgentIcon(status: string): string {
        switch (status) {
            case 'idle': return '$(circle-outline)';
            case 'active': return '$(play-circle)';
            case 'busy': return '$(loading)';
            case 'error': return '$(error)';
            case 'offline': return '$(circle-slash)';
            default: return '$(question)';
        }
    }
}

class AgentItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly category: string,
        public readonly agent?: Agent,
        public readonly iconName?: string
    ) {
        super(label, collapsibleState);
        
        this.tooltip = this.getTooltip();
        this.contextValue = category;
        
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName.replace('$(', '').replace(')', ''));
        }

        // Add commands for agent items
        if (category === 'agent' && agent) {
            this.command = {
                command: 'ruv-swarm.selectAgent',
                title: 'Select Agent',
                arguments: [agent.id]
            };
        }
    }

    private getTooltip(): string {
        if (this.agent) {
            switch (this.category) {
                case 'agent':
                    return `Agent: ${this.agent.name}\nType: ${this.agent.type}\nStatus: ${this.agent.status}\nModel: ${this.agent.model}`;
                case 'status':
                    return `Current status: ${this.agent.status}`;
                case 'performance':
                    return 'Performance metrics for this agent';
                case 'capabilities':
                    return 'Available capabilities for this agent';
                case 'metric':
                    return `${this.label} - Performance metric`;
                case 'capability':
                    return `Capability: ${this.label}`;
                case 'info':
                    return this.label;
                default:
                    return this.label;
            }
        }
        
        return this.label;
    }
}
