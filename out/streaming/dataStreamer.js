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
exports.DataStreamer = void 0;
const vscode = __importStar(require("vscode"));
class DataStreamer {
    constructor() {
        this.subscriptions = new Map();
        this.isStreaming = false;
        this.streamingRate = 1000; // Default 1 second
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Data Streamer');
    }
    async initialize() {
        this.outputChannel.appendLine('📊 Data Streamer initialized');
    }
    startStreaming(dataProvider, rate = 1000) {
        if (this.isStreaming) {
            this.stopStreaming();
        }
        this.dataProvider = dataProvider;
        this.streamingRate = rate;
        this.isStreaming = true;
        this.streamingInterval = setInterval(async () => {
            await this.collectAndBroadcastData();
        }, this.streamingRate);
        this.outputChannel.appendLine(`🔄 Started data streaming at ${rate}ms intervals`);
    }
    stopStreaming() {
        if (!this.isStreaming) {
            return;
        }
        this.isStreaming = false;
        if (this.streamingInterval) {
            clearInterval(this.streamingInterval);
            this.streamingInterval = undefined;
        }
        this.outputChannel.appendLine('⏸️ Stopped data streaming');
    }
    subscribe(id, callback, filter) {
        const subscription = {
            id,
            callback,
            filter,
            active: true
        };
        this.subscriptions.set(id, subscription);
        this.outputChannel.appendLine(`📡 New subscription: ${id}`);
    }
    unsubscribe(id) {
        const removed = this.subscriptions.delete(id);
        if (removed) {
            this.outputChannel.appendLine(`📡 Removed subscription: ${id}`);
        }
        return removed;
    }
    pauseSubscription(id) {
        const subscription = this.subscriptions.get(id);
        if (subscription) {
            subscription.active = false;
            this.outputChannel.appendLine(`⏸️ Paused subscription: ${id}`);
            return true;
        }
        return false;
    }
    resumeSubscription(id) {
        const subscription = this.subscriptions.get(id);
        if (subscription) {
            subscription.active = true;
            this.outputChannel.appendLine(`▶️ Resumed subscription: ${id}`);
            return true;
        }
        return false;
    }
    broadcast(data) {
        let deliveredCount = 0;
        for (const subscription of this.subscriptions.values()) {
            if (!subscription.active) {
                continue;
            }
            // Apply filter if provided
            if (subscription.filter && !subscription.filter(data)) {
                continue;
            }
            try {
                subscription.callback(data);
                deliveredCount++;
            }
            catch (error) {
                this.outputChannel.appendLine(`⚠️ Error delivering data to subscription ${subscription.id}: ${error}`);
            }
        }
        if (deliveredCount > 0) {
            this.outputChannel.appendLine(`📡 Delivered data to ${deliveredCount} subscriptions`);
        }
    }
    async pushData(type, data) {
        const streamData = {
            timestamp: new Date(),
            type,
            data
        };
        this.broadcast(streamData);
    }
    getSubscriptions() {
        return Array.from(this.subscriptions.values());
    }
    getActiveSubscriptionCount() {
        return Array.from(this.subscriptions.values())
            .filter(sub => sub.active).length;
    }
    isStreamingActive() {
        return this.isStreaming;
    }
    getStreamingRate() {
        return this.streamingRate;
    }
    setStreamingRate(rate) {
        this.streamingRate = rate;
        if (this.isStreaming && this.dataProvider) {
            // Restart streaming with new rate
            this.stopStreaming();
            this.startStreaming(this.dataProvider, rate);
        }
    }
    async collectAndBroadcastData() {
        if (!this.dataProvider) {
            return;
        }
        try {
            const data = await this.dataProvider();
            const streamData = {
                timestamp: new Date(),
                type: 'dashboard_update',
                data
            };
            this.broadcast(streamData);
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error collecting data: ${error}`);
        }
    }
    // Utility methods for common streaming patterns
    createPeriodicStream(id, dataProvider, interval, callback) {
        // Subscribe to the stream
        this.subscribe(id, callback);
        // Create a periodic data provider
        const periodicProvider = async () => {
            try {
                const data = await dataProvider();
                await this.pushData(`periodic_${id}`, data);
            }
            catch (error) {
                this.outputChannel.appendLine(`❌ Error in periodic stream ${id}: ${error}`);
            }
        };
        // Start periodic execution
        setInterval(periodicProvider, interval);
    }
    createEventStream(id, eventEmitter, callback, transformer) {
        // Subscribe to the stream
        this.subscribe(id, callback);
        // Listen to events and push to stream
        const disposable = eventEmitter.event((eventData) => {
            const data = transformer ? transformer(eventData) : eventData;
            this.pushData(`event_${id}`, data);
        });
        return disposable;
    }
    createFilteredStream(id, sourceStreamId, filter, callback) {
        this.subscribe(id, callback, filter);
    }
    // Analytics and monitoring
    getStreamingStats() {
        return {
            isStreaming: this.isStreaming,
            streamingRate: this.streamingRate,
            totalSubscriptions: this.subscriptions.size,
            activeSubscriptions: this.getActiveSubscriptionCount(),
            subscriptionIds: Array.from(this.subscriptions.keys())
        };
    }
    // Debugging utilities
    enableDebugLogging() {
        this.subscribe('debug_logger', (data) => {
            this.outputChannel.appendLine(`🐛 [${data.timestamp.toISOString()}] ${data.type}: ${JSON.stringify(data.data, null, 2)}`);
        });
    }
    disableDebugLogging() {
        this.unsubscribe('debug_logger');
    }
    dispose() {
        this.stopStreaming();
        // Clear all subscriptions
        this.subscriptions.clear();
        this.outputChannel.dispose();
    }
}
exports.DataStreamer = DataStreamer;
//# sourceMappingURL=dataStreamer.js.map