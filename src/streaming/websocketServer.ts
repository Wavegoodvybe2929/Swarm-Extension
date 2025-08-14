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

export class WebSocketServer implements vscode.Disposable {
    private clients: Map<string, WebSocketClient> = new Map();
    private isRunning = false;
    private heartbeatInterval?: NodeJS.Timeout;
    private readonly outputChannel: vscode.OutputChannel;
    private messageQueue: WebSocketMessage[] = [];

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm WebSocket');
    }

    async initialize(): Promise<void> {
        try {
            this.outputChannel.appendLine('🔌 WebSocket server initialized (simplified mode)');
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize WebSocket server: ${errorMessage}`);
            throw error;
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        try {
            this.isRunning = true;
            this.startHeartbeat();
            
            this.outputChannel.appendLine('✅ WebSocket server started (simplified mode)');
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to start WebSocket server: ${errorMessage}`);
            throw error;
        }
    }

    stop(): void {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        // Stop heartbeat
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = undefined;
        }

        // Clear clients
        this.clients.clear();
        this.messageQueue = [];

        this.outputChannel.appendLine('⏹️ WebSocket server stopped');
    }

    broadcast(message: WebSocketMessage): void {
        if (!this.isRunning) {
            return;
        }

        const messageWithTimestamp = {
            ...message,
            timestamp: new Date()
        };

        // In simplified mode, we just queue messages for potential future use
        this.messageQueue.push(messageWithTimestamp);
        
        // Keep only last 100 messages
        if (this.messageQueue.length > 100) {
            this.messageQueue = this.messageQueue.slice(-100);
        }

        this.outputChannel.appendLine(`📡 Queued message: ${message.type}`);
    }

    sendToClient(clientId: string, message: WebSocketMessage): boolean {
        // In simplified mode, we simulate sending
        const messageWithTimestamp = {
            ...message,
            timestamp: new Date(),
            clientId
        };

        this.messageQueue.push(messageWithTimestamp);
        this.outputChannel.appendLine(`📤 Simulated send to client ${clientId}: ${message.type}`);
        return true;
    }

    getConnectedClients(): WebSocketClient[] {
        return Array.from(this.clients.values());
    }

    getClientCount(): number {
        return this.clients.size;
    }

    isClientConnected(clientId: string): boolean {
        return this.clients.has(clientId);
    }

    getServerInfo() {
        return {
            port: 0, // No actual port in simplified mode
            isRunning: this.isRunning,
            clientCount: this.clients.size,
            uptime: this.isRunning ? Date.now() : 0,
            messageQueueSize: this.messageQueue.length
        };
    }

    // Simulate client connection for testing
    simulateClientConnection(clientId?: string): string {
        const id = clientId || this.generateClientId();
        const client: WebSocketClient = {
            id,
            isAlive: true,
            connectedAt: new Date(),
            lastActivity: new Date()
        };

        this.clients.set(id, client);
        this.outputChannel.appendLine(`🔗 Simulated client connected: ${id} (${this.clients.size} total)`);

        // Send welcome message
        this.sendToClient(id, {
            type: 'welcome',
            data: {
                clientId: id,
                serverInfo: this.getServerInfo()
            }
        });

        return id;
    }

    // Simulate client disconnection
    simulateClientDisconnection(clientId: string): boolean {
        const removed = this.clients.delete(clientId);
        if (removed) {
            this.outputChannel.appendLine(`🔌 Simulated client disconnected: ${clientId}`);
        }
        return removed;
    }

    // Get queued messages (for testing/debugging)
    getQueuedMessages(): WebSocketMessage[] {
        return [...this.messageQueue];
    }

    // Clear message queue
    clearMessageQueue(): void {
        this.messageQueue = [];
        this.outputChannel.appendLine('🗑️ Cleared message queue');
    }

    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            const now = new Date();
            const staleThreshold = 30000; // 30 seconds

            for (const [clientId, client] of this.clients.entries()) {
                // Check for stale connections
                if (now.getTime() - client.lastActivity.getTime() > staleThreshold) {
                    this.outputChannel.appendLine(`⏰ Client ${clientId} appears stale`);
                    client.isAlive = false;
                } else {
                    client.isAlive = true;
                    client.lastActivity = now;
                }
            }

            // Remove stale clients
            for (const [clientId, client] of this.clients.entries()) {
                if (!client.isAlive) {
                    this.clients.delete(clientId);
                    this.outputChannel.appendLine(`💔 Removed stale client: ${clientId}`);
                }
            }
        }, 10000); // Check every 10 seconds
    }

    private generateClientId(): string {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        this.stop();
        this.outputChannel.dispose();
    }
}
