/**
 * MCP Transport Layer - Handles stdio and WebSocket communications
 */
import { EventEmitter } from 'events';
import { MCPMessage, MCPTransportConfig, MCPConnectionState } from './mcpTypes';
export interface MCPTransportEvents {
    'message': (message: MCPMessage) => void;
    'connected': () => void;
    'disconnected': () => void;
    'error': (error: Error) => void;
    'state-changed': (state: MCPConnectionState) => void;
}
export declare abstract class MCPTransport extends EventEmitter {
    protected _state: MCPConnectionState;
    protected _config: MCPTransportConfig;
    protected _requestId: number;
    protected _pendingRequests: Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
        timeout: NodeJS.Timeout;
    }>;
    constructor(config: MCPTransportConfig);
    get state(): MCPConnectionState;
    get config(): MCPTransportConfig;
    protected setState(state: MCPConnectionState): void;
    protected generateRequestId(): string;
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract send(message: MCPMessage): Promise<void>;
    sendRequest(method: string, params?: any, timeout?: number): Promise<any>;
    protected handleMessage(message: MCPMessage): void;
    dispose(): void;
}
export declare class MCPStdioTransport extends MCPTransport {
    private _process?;
    private _buffer;
    constructor(config: MCPTransportConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: MCPMessage): Promise<void>;
    private _processBuffer;
}
export declare class MCPWebSocketTransport extends MCPTransport {
    private _ws?;
    private _reconnectAttempts;
    private _maxReconnectAttempts;
    private _reconnectDelay;
    constructor(config: MCPTransportConfig);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    send(message: MCPMessage): Promise<void>;
    private _scheduleReconnect;
}
export declare class MCPTransportFactory {
    static create(config: MCPTransportConfig): MCPTransport;
    static createStdioTransport(command: string, args?: string[], options?: {
        env?: Record<string, string>;
        cwd?: string;
    }): MCPStdioTransport;
    static createWebSocketTransport(url: string, options?: {
        headers?: Record<string, string>;
        protocols?: string[];
        timeout?: number;
    }): MCPWebSocketTransport;
}
//# sourceMappingURL=mcpTransport.d.ts.map