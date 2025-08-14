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
export declare class DataStreamer implements vscode.Disposable {
    private subscriptions;
    private streamingInterval?;
    private isStreaming;
    private dataProvider?;
    private streamingRate;
    private readonly outputChannel;
    constructor();
    initialize(): Promise<void>;
    startStreaming(dataProvider: () => Promise<any>, rate?: number): void;
    stopStreaming(): void;
    subscribe(id: string, callback: (data: StreamData) => void, filter?: (data: StreamData) => boolean): void;
    unsubscribe(id: string): boolean;
    pauseSubscription(id: string): boolean;
    resumeSubscription(id: string): boolean;
    broadcast(data: StreamData): void;
    pushData(type: string, data: any): Promise<void>;
    getSubscriptions(): StreamSubscription[];
    getActiveSubscriptionCount(): number;
    isStreamingActive(): boolean;
    getStreamingRate(): number;
    setStreamingRate(rate: number): void;
    private collectAndBroadcastData;
    createPeriodicStream(id: string, dataProvider: () => Promise<any>, interval: number, callback: (data: StreamData) => void): void;
    createEventStream(id: string, eventEmitter: vscode.EventEmitter<any>, callback: (data: StreamData) => void, transformer?: (eventData: any) => any): vscode.Disposable;
    createFilteredStream(id: string, sourceStreamId: string, filter: (data: StreamData) => boolean, callback: (data: StreamData) => void): void;
    getStreamingStats(): {
        isStreaming: boolean;
        streamingRate: number;
        totalSubscriptions: number;
        activeSubscriptions: number;
        subscriptionIds: string[];
    };
    enableDebugLogging(): void;
    disableDebugLogging(): void;
    dispose(): void;
}
//# sourceMappingURL=dataStreamer.d.ts.map