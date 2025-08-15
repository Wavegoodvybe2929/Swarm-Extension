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
exports.ActiveAgentsProvider = void 0;
const vscode = __importStar(require("vscode"));
class ActiveAgentsProvider {
    constructor(swarmManager) {
        this.swarmManager = swarmManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Listen to swarm events to refresh the tree
        this.swarmManager.onSwarmEvent((event) => {
            if (event.type === 'agent.spawned' || event.type === 'agent.terminated' || event.type === 'swarm.initialized') {
                this.refresh();
            }
        });
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            // Root level - show all agents
            const agents = this.swarmManager.getAgents();
            if (agents.length === 0) {
                return [
                    new AgentItem('No agents spawned', vscode.TreeItemCollapsibleState.None, 'empty', undefined, '$(info)')
                ];
            }
            return agents.map(agent => new AgentItem(agent.name, vscode.TreeItemCollapsibleState.Expanded, 'agent', agent, this.getAgentIcon(agent.status)));
        }
        else if (element.category === 'agent' && element.agent) {
            // Show agent details
            const agent = element.agent;
            return [
                new AgentItem(`Type: ${agent.type}`, vscode.TreeItemCollapsibleState.None, 'info', agent, '$(tag)'),
                new AgentItem(`Model: ${agent.model}`, vscode.TreeItemCollapsibleState.None, 'info', agent, '$(circuit-board)'),
                new AgentItem(`Status: ${agent.status}`, vscode.TreeItemCollapsibleState.None, 'status', agent, this.getAgentIcon(agent.status)),
                new AgentItem(`Pattern: ${agent.cognitivePattern}`, vscode.TreeItemCollapsibleState.None, 'info', agent, '$(symbol-misc)'),
                new AgentItem('Performance', vscode.TreeItemCollapsibleState.Expanded, 'performance', agent, '$(graph)'),
                new AgentItem('Capabilities', vscode.TreeItemCollapsibleState.Expanded, 'capabilities', agent, '$(tools)'),
                new AgentItem(`Created: ${agent.createdAt.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'info', agent, '$(calendar)'),
                new AgentItem(`Last Active: ${agent.lastActive.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'info', agent, '$(clock)')
            ];
        }
        else if (element.category === 'performance' && element.agent) {
            // Show performance metrics
            const perf = element.agent.performance;
            return [
                new AgentItem(`Tasks Completed: ${perf.tasksCompleted}`, vscode.TreeItemCollapsibleState.None, 'metric', element.agent, '$(check)'),
                new AgentItem(`Success Rate: ${(perf.successRate * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', element.agent, '$(pass)'),
                new AgentItem(`Avg Response: ${perf.averageResponseTime.toFixed(0)}ms`, vscode.TreeItemCollapsibleState.None, 'metric', element.agent, '$(dashboard)'),
                new AgentItem(`Token Efficiency: ${(perf.tokenEfficiency * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', element.agent, '$(symbol-misc)'),
                new AgentItem(`Accuracy: ${(perf.accuracy * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', element.agent, '$(target)')
            ];
        }
        else if (element.category === 'capabilities' && element.agent) {
            // Show capabilities
            const capabilities = element.agent.capabilities;
            if (capabilities.length === 0) {
                return [
                    new AgentItem('No specific capabilities', vscode.TreeItemCollapsibleState.None, 'info', element.agent, '$(info)')
                ];
            }
            return capabilities.map(capability => new AgentItem(capability, vscode.TreeItemCollapsibleState.None, 'capability', element.agent, '$(gear)'));
        }
        return [];
    }
    getAgentIcon(status) {
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
exports.ActiveAgentsProvider = ActiveAgentsProvider;
class AgentItem extends vscode.TreeItem {
    constructor(label, collapsibleState, category, agent, iconName) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.category = category;
        this.agent = agent;
        this.iconName = iconName;
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
    getTooltip() {
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
//# sourceMappingURL=activeAgentsProvider.js.map