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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
class StatusBarManager {
    constructor() {
        this.currentStatus = 'offline';
        this.metrics = {
            activeAgents: 0,
            queuedCommands: 0,
            runningTasks: 0,
            errorCount: 0
        };
        // Main status bar item
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        // Metrics status bar item
        this.metricsItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
        this.statusBarItem.command = 'ruv-swarm.openDashboard';
        this.metricsItem.command = 'ruv-swarm.showCommandQueue';
        this.statusBarItem.show();
        this.updateStatus('offline', 'RUV-Swarm Offline');
    }
    updateStatus(status, text, metrics) {
        this.currentStatus = status;
        if (metrics) {
            this.metrics = { ...this.metrics, ...metrics };
        }
        this.statusBarItem.text = `$(lightbulb) ${text}`;
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
    updateMetrics(metrics) {
        this.metrics = { ...this.metrics, ...metrics, lastActivity: new Date() };
        this.updateMetricsDisplay();
    }
    updateMetricsDisplay() {
        const hasActivity = this.metrics.activeAgents > 0 ||
            this.metrics.queuedCommands > 0 ||
            this.metrics.runningTasks > 0;
        if (hasActivity || this.metrics.errorCount > 0) {
            let metricsText = '';
            const parts = [];
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
        }
        else {
            this.metricsItem.hide();
        }
    }
    generateTooltip(status) {
        const baseTooltip = this.getBaseTooltip(status);
        const metricsInfo = this.getMetricsInfo();
        return metricsInfo ? `${baseTooltip}\n\n${metricsInfo}` : baseTooltip;
    }
    getBaseTooltip(status) {
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
    getMetricsInfo() {
        const info = [];
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
            }
            else {
                const hours = Math.floor(minutes / 60);
                info.push(`Last Activity: ${hours}h ago`);
            }
        }
        return info.join('\n');
    }
    generateMetricsTooltip() {
        const parts = [];
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
    showProgress(message, progress) {
        let text = message;
        if (progress !== undefined) {
            text += ` (${Math.round(progress)}%)`;
        }
        this.updateStatus('busy', text);
    }
    showError(message, errorCount) {
        if (errorCount !== undefined) {
            this.updateMetrics({ errorCount });
        }
        this.updateStatus('error', message);
    }
    clearError() {
        this.updateMetrics({ errorCount: 0 });
        if (this.currentStatus === 'error') {
            this.updateStatus('ready', 'RUV-Swarm Ready');
        }
    }
    incrementErrorCount() {
        this.updateMetrics({ errorCount: this.metrics.errorCount + 1 });
    }
    getMetrics() {
        return { ...this.metrics };
    }
    dispose() {
        this.statusBarItem.dispose();
        this.metricsItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBarManager.js.map