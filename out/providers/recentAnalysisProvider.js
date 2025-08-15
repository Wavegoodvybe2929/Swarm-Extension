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
exports.RecentAnalysisProvider = void 0;
const vscode = __importStar(require("vscode"));
class RecentAnalysisProvider {
    constructor(swarmManager) {
        this.swarmManager = swarmManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Listen to swarm events to refresh the tree
        this.swarmManager.onSwarmEvent((event) => {
            if (event.type === 'task.completed' || event.type === 'task.failed' || event.type === 'analysis.completed') {
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
            // Root level - show categories
            return [
                new AnalysisItem('Recent Tasks', vscode.TreeItemCollapsibleState.Expanded, 'tasks-category', undefined, undefined, '$(list-unordered)'),
                new AnalysisItem('Analysis Results', vscode.TreeItemCollapsibleState.Expanded, 'analysis-category', undefined, undefined, '$(search)')
            ];
        }
        else if (element.category === 'tasks-category') {
            // Show recent tasks
            const tasks = this.swarmManager.getTasks();
            const recentTasks = tasks
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(0, 10); // Show last 10 tasks
            if (recentTasks.length === 0) {
                return [
                    new AnalysisItem('No recent tasks', vscode.TreeItemCollapsibleState.None, 'empty', undefined, undefined, '$(info)')
                ];
            }
            return recentTasks.map(task => new AnalysisItem(`${task.description.substring(0, 50)}${task.description.length > 50 ? '...' : ''}`, vscode.TreeItemCollapsibleState.Expanded, 'task', task, undefined, this.getTaskIcon(task.status)));
        }
        else if (element.category === 'analysis-category') {
            // Show analysis results (placeholder for now since we don't have analysis results in SwarmManager)
            return [
                new AnalysisItem('No analysis results available', vscode.TreeItemCollapsibleState.None, 'empty', undefined, undefined, '$(info)')
            ];
        }
        else if (element.category === 'task' && element.task) {
            // Show task details
            const task = element.task;
            const items = [
                new AnalysisItem(`Type: ${task.type}`, vscode.TreeItemCollapsibleState.None, 'info', task, undefined, '$(tag)'),
                new AnalysisItem(`Status: ${task.status}`, vscode.TreeItemCollapsibleState.None, 'status', task, undefined, this.getTaskIcon(task.status)),
                new AnalysisItem(`Priority: ${task.priority}`, vscode.TreeItemCollapsibleState.None, 'info', task, undefined, this.getPriorityIcon(task.priority)),
                new AnalysisItem(`Created: ${task.createdAt.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'info', task, undefined, '$(calendar)')
            ];
            // Add completion time if completed
            if (task.completedAt) {
                items.push(new AnalysisItem(`Completed: ${task.completedAt.toLocaleString()}`, vscode.TreeItemCollapsibleState.None, 'info', task, undefined, '$(check)'));
            }
            // Add assigned agents if any
            if (task.assignedAgents.length > 0) {
                items.push(new AnalysisItem('Assigned Agents', vscode.TreeItemCollapsibleState.Expanded, 'agents', task, undefined, '$(person)'));
            }
            // Add result if available
            if (task.result) {
                items.push(new AnalysisItem('Result', vscode.TreeItemCollapsibleState.Expanded, 'result', task, undefined, task.result.success ? '$(pass)' : '$(error)'));
            }
            // Add metadata if available
            if (task.metadata.filePath) {
                items.push(new AnalysisItem(`File: ${task.metadata.filePath}`, vscode.TreeItemCollapsibleState.None, 'file', task, undefined, '$(file)'));
            }
            return items;
        }
        else if (element.category === 'agents' && element.task) {
            // Show assigned agents
            return element.task.assignedAgents.map(agentId => new AnalysisItem(agentId, vscode.TreeItemCollapsibleState.None, 'agent', element.task, undefined, '$(person)'));
        }
        else if (element.category === 'result' && element.task?.result) {
            // Show task result details
            const result = element.task.result;
            const items = [
                new AnalysisItem(`Success: ${result.success ? 'Yes' : 'No'}`, vscode.TreeItemCollapsibleState.None, 'info', element.task, undefined, result.success ? '$(pass)' : '$(error)')
            ];
            if (result.metrics) {
                items.push(new AnalysisItem('Metrics', vscode.TreeItemCollapsibleState.Expanded, 'metrics', element.task, undefined, '$(graph)'));
            }
            if (result.suggestions && result.suggestions.length > 0) {
                items.push(new AnalysisItem('Suggestions', vscode.TreeItemCollapsibleState.Expanded, 'suggestions', element.task, undefined, '$(lightbulb)'));
            }
            if (result.output) {
                items.push(new AnalysisItem('Output', vscode.TreeItemCollapsibleState.None, 'output', element.task, undefined, '$(output)'));
            }
            return items;
        }
        else if (element.category === 'metrics' && element.task?.result?.metrics) {
            // Show metrics
            const metrics = element.task.result.metrics;
            return [
                new AnalysisItem(`Duration: ${metrics.duration}ms`, vscode.TreeItemCollapsibleState.None, 'metric', element.task, undefined, '$(clock)'),
                new AnalysisItem(`Token Usage: ${metrics.tokenUsage}`, vscode.TreeItemCollapsibleState.None, 'metric', element.task, undefined, '$(symbol-misc)'),
                new AnalysisItem(`Quality Score: ${(metrics.qualityScore * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', element.task, undefined, '$(star)'),
                new AnalysisItem(`Confidence: ${(metrics.confidenceScore * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', element.task, undefined, '$(shield)')
            ];
        }
        else if (element.category === 'suggestions' && element.task?.result?.suggestions) {
            // Show suggestions
            return element.task.result.suggestions.map((suggestion, index) => new AnalysisItem(suggestion, vscode.TreeItemCollapsibleState.None, 'suggestion', element.task, undefined, '$(lightbulb)'));
        }
        return [];
    }
    getTaskIcon(status) {
        switch (status) {
            case 'pending': return '$(clock)';
            case 'running': return '$(loading)';
            case 'completed': return '$(check)';
            case 'failed': return '$(error)';
            case 'cancelled': return '$(circle-slash)';
            default: return '$(question)';
        }
    }
    getPriorityIcon(priority) {
        switch (priority) {
            case 'low': return '$(arrow-down)';
            case 'medium': return '$(dash)';
            case 'high': return '$(arrow-up)';
            case 'critical': return '$(warning)';
            default: return '$(dash)';
        }
    }
}
exports.RecentAnalysisProvider = RecentAnalysisProvider;
class AnalysisItem extends vscode.TreeItem {
    constructor(label, collapsibleState, category, task, analysis, iconName) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.category = category;
        this.task = task;
        this.analysis = analysis;
        this.iconName = iconName;
        this.tooltip = this.getTooltip();
        this.contextValue = category;
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName.replace('$(', '').replace(')', ''));
        }
        // Add commands for certain items
        if (category === 'task' && task) {
            this.command = {
                command: 'ruv-swarm.showTaskDetails',
                title: 'Show Task Details',
                arguments: [task.id]
            };
        }
        else if (category === 'file' && task?.metadata.filePath) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(task.metadata.filePath)]
            };
        }
        else if (category === 'output' && task?.result?.output) {
            this.command = {
                command: 'ruv-swarm.showTaskOutput',
                title: 'Show Output',
                arguments: [task.id]
            };
        }
    }
    getTooltip() {
        if (this.task) {
            switch (this.category) {
                case 'task':
                    return `Task: ${this.task.description}\nType: ${this.task.type}\nStatus: ${this.task.status}\nCreated: ${this.task.createdAt.toLocaleString()}`;
                case 'status':
                    return `Task status: ${this.task.status}`;
                case 'file':
                    return `File: ${this.task.metadata.filePath}`;
                case 'output':
                    return 'Click to view task output';
                case 'metric':
                    return `${this.label} - Task metric`;
                case 'suggestion':
                    return `Suggestion: ${this.label}`;
                case 'info':
                    return this.label;
                default:
                    return this.label;
            }
        }
        return this.label;
    }
}
//# sourceMappingURL=recentAnalysisProvider.js.map