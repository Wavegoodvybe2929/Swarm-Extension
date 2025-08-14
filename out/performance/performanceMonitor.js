"use strict";
/**
 * Performance Monitor - Real-time performance tracking and optimization
 */
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
exports.PerformanceMonitor = void 0;
exports.getPerformanceMonitor = getPerformanceMonitor;
exports.disposePerformanceMonitor = disposePerformanceMonitor;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
class PerformanceMonitor extends events_1.EventEmitter {
    constructor(memoryManager) {
        super();
        this._operations = new Map();
        this._completedOperations = [];
        this._metricsHistory = [];
        this._maxHistorySize = 1000;
        this._networkStats = {
            activeConnections: 0,
            totalRequests: 0,
            failedRequests: 0,
            responseTimes: []
        };
        this._fileSystemStats = {
            filesWatched: 0,
            filesAnalyzed: 0,
            analysisTimes: []
        };
        this._memoryManager = memoryManager;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm Performance');
        this._thresholds = {
            maxOperationTime: 5000, // 5 seconds
            maxMemoryUsage: 200 * 1024 * 1024, // 200MB
            maxCpuUsage: 80, // 80%
            maxResponseTime: 2000 // 2 seconds
        };
        this._setupMemoryManagerListeners();
        this._startMonitoring();
    }
    get thresholds() {
        return { ...this._thresholds };
    }
    set thresholds(thresholds) {
        this._thresholds = { ...this._thresholds, ...thresholds };
    }
    get metricsHistory() {
        return [...this._metricsHistory];
    }
    _setupMemoryManagerListeners() {
        this._memoryManager.on('memory-warning', (stats) => {
            this._createAlert('memory', 'warning', 'Memory usage is high', { memory: stats });
        });
        this._memoryManager.on('memory-critical', (stats) => {
            this._createAlert('memory', 'critical', 'Memory usage is critical', { memory: stats });
        });
    }
    _startMonitoring() {
        // Collect metrics every 10 seconds
        this._monitoringInterval = setInterval(() => {
            this._collectMetrics();
        }, 10000);
    }
    _collectMetrics() {
        const timestamp = Date.now();
        const memoryStats = this._memoryManager.getMemoryStats();
        // Calculate operation metrics
        const recentOperations = this._completedOperations.filter(op => timestamp - (op.endTime || 0) < 60000 // Last minute
        );
        const operationTimes = recentOperations
            .map(op => op.duration || 0)
            .filter(duration => duration > 0);
        const operationsPerSecond = recentOperations.length / 60;
        const averageOperationTime = operationTimes.length > 0
            ? operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length
            : 0;
        // Calculate network metrics
        const recentResponseTimes = this._networkStats.responseTimes.filter(time => time > 0);
        const averageResponseTime = recentResponseTimes.length > 0
            ? recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length
            : 0;
        // Calculate filesystem metrics
        const recentAnalysisTimes = this._fileSystemStats.analysisTimes.filter(time => time > 0);
        const averageAnalysisTime = recentAnalysisTimes.length > 0
            ? recentAnalysisTimes.reduce((sum, time) => sum + time, 0) / recentAnalysisTimes.length
            : 0;
        const metrics = {
            timestamp,
            memory: memoryStats,
            cpu: {
                usage: this._getCpuUsage(),
                loadAverage: this._getLoadAverage()
            },
            operations: {
                totalOperations: this._completedOperations.length,
                operationsPerSecond,
                averageOperationTime,
                slowestOperation: operationTimes.length > 0 ? Math.max(...operationTimes) : 0,
                fastestOperation: operationTimes.length > 0 ? Math.min(...operationTimes) : 0
            },
            network: {
                activeConnections: this._networkStats.activeConnections,
                totalRequests: this._networkStats.totalRequests,
                failedRequests: this._networkStats.failedRequests,
                averageResponseTime
            },
            fileSystem: {
                filesWatched: this._fileSystemStats.filesWatched,
                filesAnalyzed: this._fileSystemStats.filesAnalyzed,
                averageAnalysisTime
            }
        };
        // Add to history
        this._metricsHistory.push(metrics);
        if (this._metricsHistory.length > this._maxHistorySize) {
            this._metricsHistory.shift();
        }
        // Check thresholds
        this._checkThresholds(metrics);
        // Emit metrics
        this.emit('metrics-updated', metrics);
    }
    _getCpuUsage() {
        // Simplified CPU usage estimation based on operation load
        const activeOperations = this._operations.size;
        const recentOperations = this._completedOperations.filter(op => Date.now() - (op.endTime || 0) < 10000 // Last 10 seconds
        ).length;
        return Math.min(100, (activeOperations * 10) + (recentOperations * 2));
    }
    _getLoadAverage() {
        // Simplified load average based on operation queue
        const load = this._operations.size / 10;
        return [load, load * 0.8, load * 0.6];
    }
    _checkThresholds(metrics) {
        // Check memory threshold
        if (metrics.memory.heapUsed > this._thresholds.maxMemoryUsage) {
            this.emit('threshold-exceeded', 'memory', metrics.memory.heapUsed, this._thresholds.maxMemoryUsage);
        }
        // Check CPU threshold
        if (metrics.cpu.usage > this._thresholds.maxCpuUsage) {
            this.emit('threshold-exceeded', 'cpu', metrics.cpu.usage, this._thresholds.maxCpuUsage);
        }
        // Check operation time threshold
        if (metrics.operations.slowestOperation > this._thresholds.maxOperationTime) {
            this.emit('threshold-exceeded', 'operation', metrics.operations.slowestOperation, this._thresholds.maxOperationTime);
        }
        // Check response time threshold
        if (metrics.network.averageResponseTime > this._thresholds.maxResponseTime) {
            this.emit('threshold-exceeded', 'network', metrics.network.averageResponseTime, this._thresholds.maxResponseTime);
        }
    }
    _createAlert(type, severity, message, metrics) {
        const alert = {
            type,
            severity,
            message,
            metrics,
            timestamp: Date.now()
        };
        this._outputChannel.appendLine(`${severity.toUpperCase()}: ${message}`);
        this.emit('performance-alert', alert);
    }
    // Operation tracking
    startOperation(name, metadata) {
        const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const operation = {
            name,
            startTime: Date.now(),
            success: false,
            metadata
        };
        this._operations.set(operationId, operation);
        return operationId;
    }
    endOperation(operationId, success = true, error) {
        const operation = this._operations.get(operationId);
        if (!operation) {
            return;
        }
        const endTime = Date.now();
        operation.endTime = endTime;
        operation.duration = endTime - operation.startTime;
        operation.success = success;
        operation.error = error;
        // Move to completed operations
        this._operations.delete(operationId);
        this._completedOperations.push(operation);
        // Keep only recent completed operations
        const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        this._completedOperations = this._completedOperations.filter(op => (op.endTime || 0) > cutoff);
        // Check for slow operations
        if (operation.duration && operation.duration > this._thresholds.maxOperationTime) {
            this._createAlert('operation', 'warning', `Slow operation detected: ${operation.name} took ${operation.duration}ms`, {});
        }
        this.emit('operation-completed', operation);
    }
    // Network tracking
    recordNetworkRequest(responseTime, success = true) {
        this._networkStats.totalRequests++;
        if (!success) {
            this._networkStats.failedRequests++;
        }
        if (responseTime > 0) {
            this._networkStats.responseTimes.push(responseTime);
            // Keep only recent response times
            if (this._networkStats.responseTimes.length > 1000) {
                this._networkStats.responseTimes = this._networkStats.responseTimes.slice(-500);
            }
        }
    }
    updateActiveConnections(count) {
        this._networkStats.activeConnections = count;
    }
    // File system tracking
    recordFileAnalysis(analysisTime) {
        this._fileSystemStats.filesAnalyzed++;
        if (analysisTime > 0) {
            this._fileSystemStats.analysisTimes.push(analysisTime);
            // Keep only recent analysis times
            if (this._fileSystemStats.analysisTimes.length > 1000) {
                this._fileSystemStats.analysisTimes = this._fileSystemStats.analysisTimes.slice(-500);
            }
        }
    }
    updateWatchedFiles(count) {
        this._fileSystemStats.filesWatched = count;
    }
    // Utility methods
    getOperationStats() {
        const completedCount = this._completedOperations.length;
        const successfulCount = this._completedOperations.filter(op => op.success).length;
        const durations = this._completedOperations
            .map(op => op.duration || 0)
            .filter(duration => duration > 0);
        const averageDuration = durations.length > 0
            ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
            : 0;
        return {
            active: this._operations.size,
            completed: completedCount,
            averageDuration,
            successRate: completedCount > 0 ? successfulCount / completedCount : 0
        };
    }
    getPerformanceReport() {
        const latestMetrics = this._metricsHistory[this._metricsHistory.length - 1];
        if (!latestMetrics) {
            return 'No performance data available';
        }
        const operationStats = this.getOperationStats();
        let report = '=== Performance Report ===\n';
        report += `Timestamp: ${new Date(latestMetrics.timestamp).toISOString()}\n\n`;
        report += '=== Memory ===\n';
        report += `Heap Used: ${this._memoryManager.formatMemorySize(latestMetrics.memory.heapUsed)}\n`;
        report += `Heap Total: ${this._memoryManager.formatMemorySize(latestMetrics.memory.heapTotal)}\n`;
        report += `RSS: ${this._memoryManager.formatMemorySize(latestMetrics.memory.rss)}\n\n`;
        report += '=== CPU ===\n';
        report += `Usage: ${latestMetrics.cpu.usage.toFixed(1)}%\n`;
        report += `Load Average: [${latestMetrics.cpu.loadAverage.map(l => l.toFixed(2)).join(', ')}]\n\n`;
        report += '=== Operations ===\n';
        report += `Active: ${operationStats.active}\n`;
        report += `Completed: ${operationStats.completed}\n`;
        report += `Success Rate: ${(operationStats.successRate * 100).toFixed(1)}%\n`;
        report += `Average Duration: ${operationStats.averageDuration.toFixed(1)}ms\n`;
        report += `Operations/sec: ${latestMetrics.operations.operationsPerSecond.toFixed(2)}\n\n`;
        report += '=== Network ===\n';
        report += `Active Connections: ${latestMetrics.network.activeConnections}\n`;
        report += `Total Requests: ${latestMetrics.network.totalRequests}\n`;
        report += `Failed Requests: ${latestMetrics.network.failedRequests}\n`;
        report += `Average Response Time: ${latestMetrics.network.averageResponseTime.toFixed(1)}ms\n\n`;
        report += '=== File System ===\n';
        report += `Files Watched: ${latestMetrics.fileSystem.filesWatched}\n`;
        report += `Files Analyzed: ${latestMetrics.fileSystem.filesAnalyzed}\n`;
        report += `Average Analysis Time: ${latestMetrics.fileSystem.averageAnalysisTime.toFixed(1)}ms\n`;
        return report;
    }
    dispose() {
        if (this._monitoringInterval) {
            clearInterval(this._monitoringInterval);
        }
        this._operations.clear();
        this._completedOperations = [];
        this._metricsHistory = [];
        this._outputChannel.dispose();
        this.removeAllListeners();
    }
    // Type-safe event emitter methods
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
// Global performance monitor instance
let globalPerformanceMonitor;
function getPerformanceMonitor(memoryManager) {
    if (!globalPerformanceMonitor) {
        globalPerformanceMonitor = new PerformanceMonitor(memoryManager);
    }
    return globalPerformanceMonitor;
}
function disposePerformanceMonitor() {
    if (globalPerformanceMonitor) {
        globalPerformanceMonitor.dispose();
        globalPerformanceMonitor = undefined;
    }
}
//# sourceMappingURL=performanceMonitor.js.map