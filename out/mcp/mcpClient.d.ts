/**
 * MCP Client - High-level interface for MCP protocol communication
 */
import { EventEmitter } from 'events';
import { MCPServerInfo, MCPTool, MCPResource, MCPPrompt, MCPToolResult, MCPResourceContents, MCPGetPromptResult, MCPConnectionInfo, MCPClientOptions, MCPClientEvents } from './mcpTypes';
import { MCPTransport } from './mcpTransport';
export declare class MCPClient extends EventEmitter {
    private _transport;
    private _serverInfo?;
    private _tools;
    private _resources;
    private _prompts;
    private _connectionInfo;
    private _options;
    private _initialized;
    constructor(transport: MCPTransport, options?: MCPClientOptions);
    get serverInfo(): MCPServerInfo | undefined;
    get tools(): MCPTool[];
    get resources(): MCPResource[];
    get prompts(): MCPPrompt[];
    get connectionInfo(): MCPConnectionInfo;
    get isConnected(): boolean;
    get isInitialized(): boolean;
    private _setupTransportListeners;
    private _handleMessage;
    private _handleNotification;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    initialize(): Promise<MCPServerInfo>;
    ping(): Promise<void>;
    listTools(): Promise<MCPTool[]>;
    callTool(name: string, arguments_?: Record<string, any>): Promise<MCPToolResult>;
    listResources(): Promise<MCPResource[]>;
    readResource(uri: string): Promise<MCPResourceContents>;
    subscribeToResource(uri: string): Promise<void>;
    unsubscribeFromResource(uri: string): Promise<void>;
    listPrompts(): Promise<MCPPrompt[]>;
    getPrompt(name: string, arguments_?: Record<string, any>): Promise<MCPGetPromptResult>;
    private _refreshTools;
    private _refreshResources;
    private _refreshPrompts;
    withRetry<T>(operation: () => Promise<T>): Promise<T>;
    dispose(): void;
    on<K extends keyof MCPClientEvents>(event: K, listener: MCPClientEvents[K]): this;
    emit<K extends keyof MCPClientEvents>(event: K, ...args: Parameters<MCPClientEvents[K]>): boolean;
}
export declare class MCPClientFactory {
    static createStdioClient(command: string, args?: string[], options?: MCPClientOptions & {
        env?: Record<string, string>;
        cwd?: string;
    }): MCPClient;
    static createWebSocketClient(url: string, options?: MCPClientOptions & {
        headers?: Record<string, string>;
        protocols?: string[];
        connectionTimeout?: number;
    }): MCPClient;
    static createRUVSwarmStdioClient(ruvSwarmPath?: string, options?: MCPClientOptions): MCPClient;
    static createRUVSwarmWebSocketClient(port?: number, options?: MCPClientOptions): MCPClient;
}
//# sourceMappingURL=mcpClient.d.ts.map