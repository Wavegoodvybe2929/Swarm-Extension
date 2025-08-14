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
exports.WebSocketServer = void 0;
const vscode = __importStar(require("vscode"));
class WebSocketServer {
    constructor() {
        this.clients = new Map();
        this.isRunning = false;
        this.messageQueue = [];
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm WebSocket');
    }
    async initialize() {
        try {
            this.outputChannel.appendLine('🔌 WebSocket server initialized (simplified mode)');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize WebSocket server: ${errorMessage}`);
            throw error;
        }
    }
    async start() {
        if (this.isRunning) {
            return;
        }
        try {
            this.isRunning = true;
            this.startHeartbeat();
            this.outputChannel.appendLine('✅ WebSocket server started (simplified mode)');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to start WebSocket server: ${errorMessage}`);
            throw error;
        }
    }
    stop() {
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
    broadcast(message) {
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
    sendToClient(clientId, message) {
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
    getConnectedClients() {
        return Array.from(this.clients.values());
    }
    getClientCount() {
        return this.clients.size;
    }
    isClientConnected(clientId) {
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
    simulateClientConnection(clientId) {
        const id = clientId || this.generateClientId();
        const client = {
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
    simulateClientDisconnection(clientId) {
        const removed = this.clients.delete(clientId);
        if (removed) {
            this.outputChannel.appendLine(`🔌 Simulated client disconnected: ${clientId}`);
        }
        return removed;
    }
    // Get queued messages (for testing/debugging)
    getQueuedMessages() {
        return [...this.messageQueue];
    }
    // Clear message queue
    clearMessageQueue() {
        this.messageQueue = [];
        this.outputChannel.appendLine('🗑️ Cleared message queue');
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            const now = new Date();
            const staleThreshold = 30000; // 30 seconds
            for (const [clientId, client] of this.clients.entries()) {
                // Check for stale connections
                if (now.getTime() - client.lastActivity.getTime() > staleThreshold) {
                    this.outputChannel.appendLine(`⏰ Client ${clientId} appears stale`);
                    client.isAlive = false;
                }
                else {
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
    generateClientId() {
        return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    dispose() {
        this.stop();
        this.outputChannel.dispose();
    }
}
exports.WebSocketServer = WebSocketServer;
//# sourceMappingURL=websocketServer.js.map