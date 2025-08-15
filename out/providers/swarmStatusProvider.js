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
exports.SwarmStatusProvider = void 0;
const vscode = __importStar(require("vscode"));
class SwarmStatusProvider {
    constructor(swarmManager) {
        this.swarmManager = swarmManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        // Listen to swarm events to refresh the tree
        this.swarmManager.onSwarmEvent(() => {
            this.refresh();
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
            // Root level items
            const status = await this.swarmManager.getSwarmStatus();
            return [
                new SwarmStatusItem('Overview', vscode.TreeItemCollapsibleState.Expanded, 'overview', status),
                new SwarmStatusItem('Performance', vscode.TreeItemCollapsibleState.Expanded, 'performance', status),
                new SwarmStatusItem('Health', vscode.TreeItemCollapsibleState.Expanded, 'health', status)
            ];
        }
        else {
            // Child items based on category
            return this.getChildItems(element);
        }
    }
    getChildItems(element) {
        const status = element.status;
        switch (element.category) {
            case 'overview':
                return [
                    new SwarmStatusItem(`Topology: ${status.topology}`, vscode.TreeItemCollapsibleState.None, 'info', status, '$(organization)'),
                    new SwarmStatusItem(`Active Agents: ${status.activeAgents}/${status.totalAgents}`, vscode.TreeItemCollapsibleState.None, 'info', status, '$(person)'),
                    new SwarmStatusItem(`Active Tasks: ${status.activeTasks}`, vscode.TreeItemCollapsibleState.None, 'info', status, '$(play)'),
                    new SwarmStatusItem(`Completed Tasks: ${status.completedTasks}`, vscode.TreeItemCollapsibleState.None, 'info', status, '$(check)')
                ];
            case 'performance':
                return [
                    new SwarmStatusItem(`Tasks/Second: ${status.performance.tasksPerSecond.toFixed(2)}`, vscode.TreeItemCollapsibleState.None, 'metric', status, '$(dashboard)'),
                    new SwarmStatusItem(`Avg Response: ${status.performance.averageResponseTime.toFixed(0)}ms`, vscode.TreeItemCollapsibleState.None, 'metric', status, '$(clock)'),
                    new SwarmStatusItem(`Success Rate: ${(status.performance.successRate * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', status, '$(pass)'),
                    new SwarmStatusItem(`Token Efficiency: ${(status.performance.tokenEfficiency * 100).toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', status, '$(symbol-misc)'),
                    new SwarmStatusItem(`CPU Usage: ${status.performance.cpuUsage.toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', status, '$(pulse)'),
                    new SwarmStatusItem(`Memory Usage: ${status.performance.memoryUsage.toFixed(1)}%`, vscode.TreeItemCollapsibleState.None, 'metric', status, '$(database)')
                ];
            case 'health':
                const healthIcon = this.getHealthIcon(status.health.status);
                const items = [
                    new SwarmStatusItem(`Status: ${status.health.status}`, vscode.TreeItemCollapsibleState.None, 'health', status, healthIcon),
                    new SwarmStatusItem(`Last Check: ${status.health.lastHealthCheck.toLocaleTimeString()}`, vscode.TreeItemCollapsibleState.None, 'health', status, '$(history)')
                ];
                // Add issues if any
                if (status.health.issues.length > 0) {
                    items.push(new SwarmStatusItem('Issues', vscode.TreeItemCollapsibleState.Expanded, 'issues', status, '$(warning)'));
                }
                return items;
            case 'issues':
                return status.health.issues.map((issue, index) => new SwarmStatusItem(issue, vscode.TreeItemCollapsibleState.None, 'issue', status, '$(error)'));
            default:
                return [];
        }
    }
    getHealthIcon(healthStatus) {
        switch (healthStatus) {
            case 'healthy': return '$(pass-filled)';
            case 'degraded': return '$(warning)';
            case 'critical': return '$(error)';
            case 'offline': return '$(circle-slash)';
            default: return '$(question)';
        }
    }
}
exports.SwarmStatusProvider = SwarmStatusProvider;
class SwarmStatusItem extends vscode.TreeItem {
    constructor(label, collapsibleState, category, status, iconName) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.category = category;
        this.status = status;
        this.iconName = iconName;
        this.tooltip = this.getTooltip();
        this.contextValue = category;
        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName.replace('$(', '').replace(')', ''));
        }
    }
    getTooltip() {
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
//# sourceMappingURL=swarmStatusProvider.js.map