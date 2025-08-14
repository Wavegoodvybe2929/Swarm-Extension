import * as vscode from 'vscode';

export interface StreamData {
    timestamp: Date;
    type: string;
    data: any;
}

export interface StreamSubscription {
    id: string;
    callback: (data: StreamData) => void;
    filter?: (data: StreamData) => boolean;
    active: boolean;
}

export class DataStreamer implements vscode.Disposable {
    private subscriptions: Map<string, StreamSubscription> = new Map();
    private streamingInterval?: NodeJS.Timeout;
    private isStreaming = false;
    private dataProvider?: () => Promise<any>;
    private streamingRate = 1000; // Default 1 second
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Data Streamer');
    }

    async initialize(): Promise<void> {
        this.outputChannel.appendLine('📊 Data Streamer initialized');
    }

    startStreaming(dataProvider: () => Promise<any>, rate: number = 1000): void {
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

    stopStreaming(): void {
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

    subscribe(
        id: string,
        callback: (data: StreamData) => void,
        filter?: (data: StreamData) => boolean
    ): void {
        const subscription: StreamSubscription = {
            id,
            callback,
            filter,
            active: true
        };

        this.subscriptions.set(id, subscription);
        this.outputChannel.appendLine(`📡 New subscription: ${id}`);
    }

    unsubscribe(id: string): boolean {
        const removed = this.subscriptions.delete(id);
        if (removed) {
            this.outputChannel.appendLine(`📡 Removed subscription: ${id}`);
        }
        return removed;
    }

    pauseSubscription(id: string): boolean {
        const subscription = this.subscriptions.get(id);
        if (subscription) {
            subscription.active = false;
            this.outputChannel.appendLine(`⏸️ Paused subscription: ${id}`);
            return true;
        }
        return false;
    }

    resumeSubscription(id: string): boolean {
        const subscription = this.subscriptions.get(id);
        if (subscription) {
            subscription.active = true;
            this.outputChannel.appendLine(`▶️ Resumed subscription: ${id}`);
            return true;
        }
        return false;
    }

    broadcast(data: StreamData): void {
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
            } catch (error) {
                this.outputChannel.appendLine(`⚠️ Error delivering data to subscription ${subscription.id}: ${error}`);
            }
        }

        if (deliveredCount > 0) {
            this.outputChannel.appendLine(`📡 Delivered data to ${deliveredCount} subscriptions`);
        }
    }

    async pushData(type: string, data: any): Promise<void> {
        const streamData: StreamData = {
            timestamp: new Date(),
            type,
            data
        };

        this.broadcast(streamData);
    }

    getSubscriptions(): StreamSubscription[] {
        return Array.from(this.subscriptions.values());
    }

    getActiveSubscriptionCount(): number {
        return Array.from(this.subscriptions.values())
            .filter(sub => sub.active).length;
    }

    isStreamingActive(): boolean {
        return this.isStreaming;
    }

    getStreamingRate(): number {
        return this.streamingRate;
    }

    setStreamingRate(rate: number): void {
        this.streamingRate = rate;
        
        if (this.isStreaming && this.dataProvider) {
            // Restart streaming with new rate
            this.stopStreaming();
            this.startStreaming(this.dataProvider, rate);
        }
    }

    private async collectAndBroadcastData(): Promise<void> {
        if (!this.dataProvider) {
            return;
        }

        try {
            const data = await this.dataProvider();
            
            const streamData: StreamData = {
                timestamp: new Date(),
                type: 'dashboard_update',
                data
            };

            this.broadcast(streamData);
            
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error collecting data: ${error}`);
        }
    }

    // Utility methods for common streaming patterns
    createPeriodicStream(
        id: string,
        dataProvider: () => Promise<any>,
        interval: number,
        callback: (data: StreamData) => void
    ): void {
        // Subscribe to the stream
        this.subscribe(id, callback);

        // Create a periodic data provider
        const periodicProvider = async () => {
            try {
                const data = await dataProvider();
                await this.pushData(`periodic_${id}`, data);
            } catch (error) {
                this.outputChannel.appendLine(`❌ Error in periodic stream ${id}: ${error}`);
            }
        };

        // Start periodic execution
        setInterval(periodicProvider, interval);
    }

    createEventStream(
        id: string,
        eventEmitter: vscode.EventEmitter<any>,
        callback: (data: StreamData) => void,
        transformer?: (eventData: any) => any
    ): vscode.Disposable {
        // Subscribe to the stream
        this.subscribe(id, callback);

        // Listen to events and push to stream
        const disposable = eventEmitter.event((eventData) => {
            const data = transformer ? transformer(eventData) : eventData;
            this.pushData(`event_${id}`, data);
        });

        return disposable;
    }

    createFilteredStream(
        id: string,
        sourceStreamId: string,
        filter: (data: StreamData) => boolean,
        callback: (data: StreamData) => void
    ): void {
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
    enableDebugLogging(): void {
        this.subscribe('debug_logger', (data) => {
            this.outputChannel.appendLine(`🐛 [${data.timestamp.toISOString()}] ${data.type}: ${JSON.stringify(data.data, null, 2)}`);
        });
    }

    disableDebugLogging(): void {
        this.unsubscribe('debug_logger');
    }

    dispose(): void {
        this.stopStreaming();
        
        // Clear all subscriptions
        this.subscriptions.clear();
        
        this.outputChannel.dispose();
    }
}
