/**
 * Performance Monitor - Real-time performance tracking and optimization
 */
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
export declare class PerformanceMonitor extends EventEmitter {
    private _memoryManager;
    private _operations;
    private _completedOperations;
    private _thresholds;
    private _monitoringInterval?;
    private _outputChannel;
    private _metricsHistory;
    private _maxHistorySize;
    private _networkStats;
    private _fileSystemStats;
    constructor(memoryManager: MemoryManager);
    get thresholds(): PerformanceThresholds;
    set thresholds(thresholds: Partial<PerformanceThresholds>);
    get metricsHistory(): PerformanceMetrics[];
    private _setupMemoryManagerListeners;
    private _startMonitoring;
    private _collectMetrics;
    private _getCpuUsage;
    private _getLoadAverage;
    private _checkThresholds;
    private _createAlert;
    startOperation(name: string, metadata?: Record<string, any>): string;
    endOperation(operationId: string, success?: boolean, error?: string): void;
    recordNetworkRequest(responseTime: number, success?: boolean): void;
    updateActiveConnections(count: number): void;
    recordFileAnalysis(analysisTime: number): void;
    updateWatchedFiles(count: number): void;
    getOperationStats(): {
        active: number;
        completed: number;
        averageDuration: number;
        successRate: number;
    };
    getPerformanceReport(): string;
    dispose(): void;
    on<K extends keyof PerformanceMonitorEvents>(event: K, listener: PerformanceMonitorEvents[K]): this;
    emit<K extends keyof PerformanceMonitorEvents>(event: K, ...args: Parameters<PerformanceMonitorEvents[K]>): boolean;
}
export declare function getPerformanceMonitor(memoryManager: MemoryManager): PerformanceMonitor;
export declare function disposePerformanceMonitor(): void;
//# sourceMappingURL=performanceMonitor.d.ts.map