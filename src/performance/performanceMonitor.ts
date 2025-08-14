/**
 * Performance Monitor - Real-time performance tracking and optimization
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { MemoryManager, MemoryStats } from './memoryManager';

export interface PerformanceMetrics {
    timestamp: number;
    memory: MemoryStats;
    cpu: {
        usage: number;
        loadAverage: number[];
    };
    operations: {
        totalOperations: number;
        operationsPerSecond: number;
        averageOperationTime: number;
        slowestOperation: number;
        fastestOperation: number;
    };
    network: {
        activeConnections: number;
        totalRequests: number;
        failedRequests: number;
        averageResponseTime: number;
    };
    fileSystem: {
        filesWatched: number;
        filesAnalyzed: number;
        averageAnalysisTime: number;
    };
}

export interface OperationMetric {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    error?: string;
    metadata?: Record<string, any>;
}

export interface PerformanceThresholds {
    maxOperationTime: number;
    maxMemoryUsage: number;
    maxCpuUsage: number;
    maxResponseTime: number;
}

export interface PerformanceAlert {
    type: 'memory' | 'cpu' | 'operation' | 'network' | 'filesystem';
    severity: 'warning' | 'critical';
    message: string;
    metrics: Partial<PerformanceMetrics>;
    timestamp: number;
}

export interface PerformanceMonitorEvents {
    'metrics-updated': (metrics: PerformanceMetrics) => void;
    'performance-alert': (alert: PerformanceAlert) => void;
    'operation-completed': (operation: OperationMetric) => void;
    'threshold-exceeded': (type: string, value: number, threshold: number) => void;
}

export class PerformanceMonitor extends EventEmitter {
    private _memoryManager: MemoryManager;
    private _operations = new Map<string, OperationMetric>();
    private _completedOperations: OperationMetric[] = [];
    private _thresholds: PerformanceThresholds;
    private _monitoringInterval?: NodeJS.Timeout;
    private _outputChannel: vscode.OutputChannel;
    private _metricsHistory: PerformanceMetrics[] = [];
    private _maxHistorySize = 1000;
    private _networkStats = {
        activeConnections: 0,
        totalRequests: 0,
        failedRequests: 0,
        responseTimes: [] as number[]
    };
    private _fileSystemStats = {
        filesWatched: 0,
        filesAnalyzed: 0,
        analysisTimes: [] as number[]
    };

    constructor(memoryManager: MemoryManager) {
        super();
        this._memoryManager = memoryManager;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm Performance');
        
        this._thresholds = {
            maxOperationTime: 5000,      // 5 seconds
            maxMemoryUsage: 200 * 1024 * 1024, // 200MB
            maxCpuUsage: 80,             // 80%
            maxResponseTime: 2000        // 2 seconds
        };

        this._setupMemoryManagerListeners();
        this._startMonitoring();
    }

    get thresholds(): PerformanceThresholds {
        return { ...this._thresholds };
    }

    set thresholds(thresholds: Partial<PerformanceThresholds>) {
        this._thresholds = { ...this._thresholds, ...thresholds };
    }

    get metricsHistory(): PerformanceMetrics[] {
        return [...this._metricsHistory];
    }

    private _setupMemoryManagerListeners(): void {
        this._memoryManager.on('memory-warning', (stats) => {
            this._createAlert('memory', 'warning', 'Memory usage is high', { memory: stats });
        });

        this._memoryManager.on('memory-critical', (stats) => {
            this._createAlert('memory', 'critical', 'Memory usage is critical', { memory: stats });
        });
    }

    private _startMonitoring(): void {
        // Collect metrics every 10 seconds
        this._monitoringInterval = setInterval(() => {
            this._collectMetrics();
        }, 10000);
    }

    private _collectMetrics(): void {
        const timestamp = Date.now();
        const memoryStats = this._memoryManager.getMemoryStats();
        
        // Calculate operation metrics
        const recentOperations = this._completedOperations.filter(
            op => timestamp - (op.endTime || 0) < 60000 // Last minute
        );
        
        const operationTimes = recentOperations
            .map(op => op.duration || 0)
            .filter(duration => duration > 0);

        const operationsPerSecond = recentOperations.length / 60;
        const averageOperationTime = operationTimes.length > 0 
            ? operationTimes.reduce((sum, time) => sum + time, 0) / operationTimes.length 
            : 0;

        // Calculate network metrics
        const recentResponseTimes = this._networkStats.responseTimes.filter(
            time => time > 0
        );
        const averageResponseTime = recentResponseTimes.length > 0
            ? recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length
            : 0;

        // Calculate filesystem metrics
        const recentAnalysisTimes = this._fileSystemStats.analysisTimes.filter(
            time => time > 0
        );
        const averageAnalysisTime = recentAnalysisTimes.length > 0
            ? recentAnalysisTimes.reduce((sum, time) => sum + time, 0) / recentAnalysisTimes.length
            : 0;

        const metrics: PerformanceMetrics = {
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

    private _getCpuUsage(): number {
        // Simplified CPU usage estimation based on operation load
        const activeOperations = this._operations.size;
        const recentOperations = this._completedOperations.filter(
            op => Date.now() - (op.endTime || 0) < 10000 // Last 10 seconds
        ).length;
        
        return Math.min(100, (activeOperations * 10) + (recentOperations * 2));
    }

    private _getLoadAverage(): number[] {
        // Simplified load average based on operation queue
        const load = this._operations.size / 10;
        return [load, load * 0.8, load * 0.6];
    }

    private _checkThresholds(metrics: PerformanceMetrics): void {
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

    private _createAlert(
        type: PerformanceAlert['type'],
        severity: PerformanceAlert['severity'],
        message: string,
        metrics: Partial<PerformanceMetrics>
    ): void {
        const alert: PerformanceAlert = {
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
    startOperation(name: string, metadata?: Record<string, any>): string {
        const operationId = `${name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const operation: OperationMetric = {
            name,
            startTime: Date.now(),
            success: false,
            metadata
        };

        this._operations.set(operationId, operation);
        return operationId;
    }

    endOperation(operationId: string, success: boolean = true, error?: string): void {
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
        this._completedOperations = this._completedOperations.filter(
            op => (op.endTime || 0) > cutoff
        );

        // Check for slow operations
        if (operation.duration && operation.duration > this._thresholds.maxOperationTime) {
            this._createAlert(
                'operation',
                'warning',
                `Slow operation detected: ${operation.name} took ${operation.duration}ms`,
                {}
            );
        }

        this.emit('operation-completed', operation);
    }

    // Network tracking
    recordNetworkRequest(responseTime: number, success: boolean = true): void {
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

    updateActiveConnections(count: number): void {
        this._networkStats.activeConnections = count;
    }

    // File system tracking
    recordFileAnalysis(analysisTime: number): void {
        this._fileSystemStats.filesAnalyzed++;
        if (analysisTime > 0) {
            this._fileSystemStats.analysisTimes.push(analysisTime);
            // Keep only recent analysis times
            if (this._fileSystemStats.analysisTimes.length > 1000) {
                this._fileSystemStats.analysisTimes = this._fileSystemStats.analysisTimes.slice(-500);
            }
        }
    }

    updateWatchedFiles(count: number): void {
        this._fileSystemStats.filesWatched = count;
    }

    // Utility methods
    getOperationStats(): {
        active: number;
        completed: number;
        averageDuration: number;
        successRate: number;
    } {
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

    getPerformanceReport(): string {
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

    dispose(): void {
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
    on<K extends keyof PerformanceMonitorEvents>(event: K, listener: PerformanceMonitorEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof PerformanceMonitorEvents>(event: K, ...args: Parameters<PerformanceMonitorEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}

// Global performance monitor instance
let globalPerformanceMonitor: PerformanceMonitor | undefined;

export function getPerformanceMonitor(memoryManager: MemoryManager): PerformanceMonitor {
    if (!globalPerformanceMonitor) {
        globalPerformanceMonitor = new PerformanceMonitor(memoryManager);
    }
    return globalPerformanceMonitor;
}

export function disposePerformanceMonitor(): void {
    if (globalPerformanceMonitor) {
        globalPerformanceMonitor.dispose();
        globalPerformanceMonitor = undefined;
    }
}
