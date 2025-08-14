/**
 * Memory Manager - Advanced memory management and optimization
 */

import * as vscode from 'vscode';
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

export class LRUCache<T = any> {
    private _cache = new Map<string, CacheEntry<T>>();
    private _maxSize: number;
    private _maxEntries: number;
    private _hits = 0;
    private _misses = 0;
    private _evictions = 0;

    constructor(maxSize: number = 50 * 1024 * 1024, maxEntries: number = 1000) {
        this._maxSize = maxSize;
        this._maxEntries = maxEntries;
    }

    get(key: string): T | undefined {
        const entry = this._cache.get(key);
        if (!entry) {
            this._misses++;
            return undefined;
        }

        // Check TTL
        if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
            this._cache.delete(key);
            this._misses++;
            return undefined;
        }

        // Update access info
        entry.lastAccessed = Date.now();
        entry.accessCount++;
        this._hits++;

        // Move to end (most recently used)
        this._cache.delete(key);
        this._cache.set(key, entry);

        return entry.data;
    }

    set(key: string, data: T, ttl?: number): void {
        const size = this._estimateSize(data);
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            accessCount: 1,
            lastAccessed: Date.now(),
            size,
            ttl
        };

        // Remove existing entry if it exists
        if (this._cache.has(key)) {
            this._cache.delete(key);
        }

        // Add new entry
        this._cache.set(key, entry);

        // Cleanup if necessary
        this._cleanup();
    }

    delete(key: string): boolean {
        return this._cache.delete(key);
    }

    clear(): void {
        this._cache.clear();
        this._hits = 0;
        this._misses = 0;
        this._evictions = 0;
    }

    has(key: string): boolean {
        const entry = this._cache.get(key);
        if (!entry) {return false;}

        // Check TTL
        if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
            this._cache.delete(key);
            return false;
        }

        return true;
    }

    getStats(): CacheStats {
        const totalRequests = this._hits + this._misses;
        return {
            totalEntries: this._cache.size,
            totalSize: this._getTotalSize(),
            hitRate: totalRequests > 0 ? this._hits / totalRequests : 0,
            missRate: totalRequests > 0 ? this._misses / totalRequests : 0,
            evictions: this._evictions
        };
    }

    private _cleanup(): void {
        // Remove expired entries
        const now = Date.now();
        for (const [key, entry] of this._cache) {
            if (entry.ttl && now > entry.timestamp + entry.ttl) {
                this._cache.delete(key);
                this._evictions++;
            }
        }

        // Check size limits
        while (this._cache.size > this._maxEntries || this._getTotalSize() > this._maxSize) {
            // Remove least recently used entry
            const firstKey = this._cache.keys().next().value;
            if (firstKey) {
                this._cache.delete(firstKey);
                this._evictions++;
            } else {
                break;
            }
        }
    }

    private _getTotalSize(): number {
        let total = 0;
        for (const entry of this._cache.values()) {
            total += entry.size;
        }
        return total;
    }

    private _estimateSize(data: any): number {
        if (data === null || data === undefined) {return 0;}
        
        if (typeof data === 'string') {
            return data.length * 2; // UTF-16
        }
        
        if (typeof data === 'number') {
            return 8;
        }
        
        if (typeof data === 'boolean') {
            return 4;
        }
        
        if (data instanceof ArrayBuffer) {
            return data.byteLength;
        }
        
        if (Array.isArray(data)) {
            return data.reduce((sum, item) => sum + this._estimateSize(item), 0);
        }
        
        if (typeof data === 'object') {
            return Object.keys(data).reduce((sum, key) => {
                return sum + key.length * 2 + this._estimateSize(data[key]);
            }, 0);
        }
        
        return 100; // Default estimate
    }
}

export interface MemoryManagerEvents {
    'memory-warning': (stats: MemoryStats) => void;
    'memory-critical': (stats: MemoryStats) => void;
    'cleanup-performed': (freedBytes: number) => void;
    'cache-stats': (stats: CacheStats) => void;
}

export class MemoryManager extends EventEmitter {
    private _caches = new Map<string, LRUCache>();
    private _thresholds: MemoryThresholds;
    private _monitoringInterval?: NodeJS.Timeout;
    private _cleanupInterval?: NodeJS.Timeout;
    private _outputChannel: vscode.OutputChannel;
    private _lastStats?: MemoryStats;

    constructor() {
        super();
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm Memory');
        
        // Default thresholds (in bytes)
        this._thresholds = {
            warning: 100 * 1024 * 1024,   // 100MB
            critical: 200 * 1024 * 1024,  // 200MB
            cleanup: 150 * 1024 * 1024    // 150MB
        };

        this._startMonitoring();
    }

    get thresholds(): MemoryThresholds {
        return { ...this._thresholds };
    }

    set thresholds(thresholds: Partial<MemoryThresholds>) {
        this._thresholds = { ...this._thresholds, ...thresholds };
    }

    getCache<T = any>(name: string, maxSize?: number, maxEntries?: number): LRUCache<T> {
        if (!this._caches.has(name)) {
            this._caches.set(name, new LRUCache<T>(maxSize, maxEntries));
        }
        return this._caches.get(name)! as LRUCache<T>;
    }

    removeCache(name: string): boolean {
        const cache = this._caches.get(name);
        if (cache) {
            cache.clear();
            this._caches.delete(name);
            return true;
        }
        return false;
    }

    clearAllCaches(): void {
        for (const cache of this._caches.values()) {
            cache.clear();
        }
        this._outputChannel.appendLine('All caches cleared');
    }

    getMemoryStats(): MemoryStats {
        const memUsage = process.memoryUsage();
        return {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            arrayBuffers: memUsage.arrayBuffers
        };
    }

    getCacheStats(): Map<string, CacheStats> {
        const stats = new Map<string, CacheStats>();
        for (const [name, cache] of this._caches) {
            stats.set(name, cache.getStats());
        }
        return stats;
    }

    async performCleanup(): Promise<number> {
        const beforeStats = this.getMemoryStats();
        let freedBytes = 0;

        // Clear least used caches first
        const cacheStats = this.getCacheStats();
        const sortedCaches = Array.from(cacheStats.entries())
            .sort(([, a], [, b]) => a.hitRate - b.hitRate);

        for (const [name, stats] of sortedCaches) {
            if (stats.hitRate < 0.1 && stats.totalEntries > 0) {
                const cache = this._caches.get(name);
                if (cache) {
                    cache.clear();
                    freedBytes += stats.totalSize;
                    this._outputChannel.appendLine(`Cleared cache: ${name} (${stats.totalSize} bytes)`);
                }
            }
        }

        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        const afterStats = this.getMemoryStats();
        const actualFreed = beforeStats.heapUsed - afterStats.heapUsed;
        
        this._outputChannel.appendLine(
            `Cleanup completed: ${actualFreed} bytes freed (estimated: ${freedBytes})`
        );

        this.emit('cleanup-performed', actualFreed);
        return actualFreed;
    }

    async optimizeMemory(): Promise<void> {
        const stats = this.getMemoryStats();
        
        if (stats.heapUsed > this._thresholds.cleanup) {
            await this.performCleanup();
        }

        // Optimize cache sizes based on usage
        const cacheStats = this.getCacheStats();
        for (const [name, cache] of this._caches) {
            const stats = cacheStats.get(name);
            if (stats && stats.hitRate < 0.05) {
                // Very low hit rate, reduce cache size
                cache.clear();
                this._outputChannel.appendLine(`Optimized cache: ${name} (low hit rate: ${stats.hitRate})`);
            }
        }
    }

    private _startMonitoring(): void {
        // Monitor memory every 30 seconds
        this._monitoringInterval = setInterval(() => {
            this._checkMemoryUsage();
        }, 30000);

        // Cleanup every 5 minutes
        this._cleanupInterval = setInterval(() => {
            this.optimizeMemory().catch(error => {
                this._outputChannel.appendLine(`Memory optimization error: ${error}`);
            });
        }, 5 * 60 * 1000);
    }

    private _checkMemoryUsage(): void {
        const stats = this.getMemoryStats();
        this._lastStats = stats;

        if (stats.heapUsed > this._thresholds.critical) {
            this.emit('memory-critical', stats);
            this._outputChannel.appendLine(
                `CRITICAL: Memory usage ${(stats.heapUsed / 1024 / 1024).toFixed(1)}MB`
            );
            // Perform immediate cleanup
            this.performCleanup().catch(error => {
                this._outputChannel.appendLine(`Emergency cleanup failed: ${error}`);
            });
        } else if (stats.heapUsed > this._thresholds.warning) {
            this.emit('memory-warning', stats);
            this._outputChannel.appendLine(
                `WARNING: Memory usage ${(stats.heapUsed / 1024 / 1024).toFixed(1)}MB`
            );
        }

        // Emit cache stats periodically
        const cacheStats = this.getCacheStats();
        for (const [name, stats] of cacheStats) {
            this.emit('cache-stats', stats);
        }
    }

    formatMemorySize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    getMemoryReport(): string {
        const stats = this.getMemoryStats();
        const cacheStats = this.getCacheStats();
        
        let report = '=== Memory Report ===\n';
        report += `Heap Used: ${this.formatMemorySize(stats.heapUsed)}\n`;
        report += `Heap Total: ${this.formatMemorySize(stats.heapTotal)}\n`;
        report += `External: ${this.formatMemorySize(stats.external)}\n`;
        report += `RSS: ${this.formatMemorySize(stats.rss)}\n`;
        report += `Array Buffers: ${this.formatMemorySize(stats.arrayBuffers)}\n\n`;

        report += '=== Cache Statistics ===\n';
        for (const [name, cache] of cacheStats) {
            report += `${name}:\n`;
            report += `  Entries: ${cache.totalEntries}\n`;
            report += `  Size: ${this.formatMemorySize(cache.totalSize)}\n`;
            report += `  Hit Rate: ${(cache.hitRate * 100).toFixed(1)}%\n`;
            report += `  Evictions: ${cache.evictions}\n\n`;
        }

        return report;
    }

    dispose(): void {
        if (this._monitoringInterval) {
            clearInterval(this._monitoringInterval);
        }
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        
        this.clearAllCaches();
        this._outputChannel.dispose();
        this.removeAllListeners();
    }

    // Type-safe event emitter methods
    on<K extends keyof MemoryManagerEvents>(event: K, listener: MemoryManagerEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof MemoryManagerEvents>(event: K, ...args: Parameters<MemoryManagerEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}

// Global memory manager instance
let globalMemoryManager: MemoryManager | undefined;

export function getMemoryManager(): MemoryManager {
    if (!globalMemoryManager) {
        globalMemoryManager = new MemoryManager();
    }
    return globalMemoryManager;
}

export function disposeMemoryManager(): void {
    if (globalMemoryManager) {
        globalMemoryManager.dispose();
        globalMemoryManager = undefined;
    }
}
