import * as vscode from 'vscode';
export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp?: Date;
    clientId?: string;
}
export interface WebSocketClient {
    id: string;
    isAlive: boolean;
    connectedAt: Date;
    lastActivity: Date;
}
export declare class WebSocketServer implements vscode.Disposable {
    private clients;
    private isRunning;
    private heartbeatInterval?;
    private readonly outputChannel;
    private messageQueue;
    constructor();
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): void;
    broadcast(message: WebSocketMessage): void;
    sendToClient(clientId: string, message: WebSocketMessage): boolean;
    getConnectedClients(): WebSocketClient[];
    getClientCount(): number;
    isClientConnected(clientId: string): boolean;
    getServerInfo(): {
        port: number;
        isRunning: boolean;
        clientCount: number;
        uptime: number;
        messageQueueSize: number;
    };
    simulateClientConnection(clientId?: string): string;
    simulateClientDisconnection(clientId: string): boolean;
    getQueuedMessages(): WebSocketMessage[];
    clearMessageQueue(): void;
    private startHeartbeat;
    private generateClientId;
    dispose(): void;
}
//# sourceMappingURL=websocketServer.d.ts.map