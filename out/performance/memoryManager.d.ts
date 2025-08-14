/**
 * Memory Manager - Advanced memory management and optimization
 */
import { EventEmitter } from 'events';
export interface MemoryStats {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    arrayBuffers: number;
}
export interface MemoryThresholds {
    warning: number;
    critical: number;
    cleanup: number;
}
export interface CacheEntry<T = any> {
    data: T;
    timestamp: number;
    accessCount: number;
    lastAccessed: number;
    size: number;
    ttl?: number;
}
export interface CacheStats {
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    missRate: number;
    evictions: number;
}
export declare class LRUCache<T = any> {
    private _cache;
    private _maxSize;
    private _maxEntries;
    private _hits;
    private _misses;
    private _evictions;
    constructor(maxSize?: number, maxEntries?: number);
    get(key: string): T | undefined;
    set(key: string, data: T, ttl?: number): void;
    delete(key: string): boolean;
    clear(): void;
    has(key: string): boolean;
    getStats(): CacheStats;
    private _cleanup;
    private _getTotalSize;
    private _estimateSize;
}
export interface MemoryManagerEvents {
    'memory-warning': (stats: MemoryStats) => void;
    'memory-critical': (stats: MemoryStats) => void;
    'cleanup-performed': (freedBytes: number) => void;
    'cache-stats': (stats: CacheStats) => void;
}
export declare class MemoryManager extends EventEmitter {
    private _caches;
    private _thresholds;
    private _monitoringInterval?;
    private _cleanupInterval?;
    private _outputChannel;
    private _lastStats?;
    constructor();
    get thresholds(): MemoryThresholds;
    set thresholds(thresholds: Partial<MemoryThresholds>);
    getCache<T = any>(name: string, maxSize?: number, maxEntries?: number): LRUCache<T>;
    removeCache(name: string): boolean;
    clearAllCaches(): void;
    getMemoryStats(): MemoryStats;
    getCacheStats(): Map<string, CacheStats>;
    performCleanup(): Promise<number>;
    optimizeMemory(): Promise<void>;
    private _startMonitoring;
    private _checkMemoryUsage;
    formatMemorySize(bytes: number): string;
    getMemoryReport(): string;
    dispose(): void;
    on<K extends keyof MemoryManagerEvents>(event: K, listener: MemoryManagerEvents[K]): this;
    emit<K extends keyof MemoryManagerEvents>(event: K, ...args: Parameters<MemoryManagerEvents[K]>): boolean;
}
export declare function getMemoryManager(): MemoryManager;
export declare function disposeMemoryManager(): void;
//# sourceMappingURL=memoryManager.d.ts.map