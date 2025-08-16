/**
 * MCP Client - High-level interface for MCP protocol communication
 */

import { EventEmitter } from 'events';
import {
    MCPMessage,
    MCPServerInfo,
    MCPTool,
    MCPResource,
    MCPPrompt,
    MCPToolCall,
    MCPToolResult,
    MCPResourceContents,
    MCPGetPromptResult,
    MCPLogEntry,
    MCPConnectionState,
    MCPConnectionInfo,
    MCPClientOptions,
    MCPClientEvents,
    MCPErrorCodes
} from './mcpTypes';
import { MCPTransport, MCPTransportFactory } from './mcpTransport';

export class MCPClient extends EventEmitter {
    private _transport: MCPTransport;
    private _serverInfo?: MCPServerInfo;
    private _tools: MCPTool[] = [];
    private _resources: MCPResource[] = [];
    private _prompts: MCPPrompt[] = [];
    private _connectionInfo: MCPConnectionInfo;
    private _options: Required<MCPClientOptions>;
    private _initialized = false;

    constructor(transport: MCPTransport, options: MCPClientOptions = {}) {
        super();
        
        this._transport = transport;
        this._options = {
            timeout: options.timeout || 30000,
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000,
            enableLogging: options.enableLogging || true,
            logLevel: options.logLevel || 'info'
        };

        this._connectionInfo = {
            state: 'disconnected'
        };

        this._setupTransportListeners();
    }

    get serverInfo(): MCPServerInfo | undefined {
        return this._serverInfo;
    }

    get tools(): MCPTool[] {
        return [...this._tools];
    }

    get resources(): MCPResource[] {
        return [...this._resources];
    }

    get prompts(): MCPPrompt[] {
        return [...this._prompts];
    }

    get connectionInfo(): MCPConnectionInfo {
        return { ...this._connectionInfo };
    }

    get isConnected(): boolean {
        return this._connectionInfo.state === 'connected';
    }

    get isInitialized(): boolean {
        return this._initialized;
    }

    private _setupTransportListeners(): void {
        this._transport.on('state-changed', (state: MCPConnectionState) => {
            this._connectionInfo.state = state;
            
            if (state === 'connected') {
                this._connectionInfo.connectedAt = new Date();
            } else if (state === 'disconnected') {
                this._initialized = false;
                this._serverInfo = undefined;
                this._tools = [];
                this._resources = [];
                this._prompts = [];
            }

            this.emit('connection-state-changed', state, this._connectionInfo);
        });

        this._transport.on('error', (error: Error) => {
            this._connectionInfo.error = error.message;
            this.emit('error', error);
        });

        this._transport.on('message', (message: MCPMessage) => {
            this._handleMessage(message);
        });
    }

    private _handleMessage(message: MCPMessage): void {
        this._connectionInfo.lastActivity = new Date();

        // Handle notifications
        if (!message.id && message.method) {
            this._handleNotification(message);
            return;
        }

        // Other messages are handled by the transport layer
    }

    private _handleNotification(message: MCPMessage): void {
        switch (message.method) {
            case 'notifications/tools/list_changed':
                this._refreshTools().catch(error => {
                    console.error('Failed to refresh tools:', error);
                });
                break;

            case 'notifications/resources/list_changed':
                this._refreshResources().catch(error => {
                    console.error('Failed to refresh resources:', error);
                });
                break;

            case 'notifications/prompts/list_changed':
                this._refreshPrompts().catch(error => {
                    console.error('Failed to refresh prompts:', error);
                });
                break;

            case 'notifications/resources/updated':
                // Handle resource updates
                break;

            case 'logging/message':
                if (message.params) {
                    const logEntry: MCPLogEntry = message.params;
                    this.emit('log-message', logEntry);
                }
                break;
        }
    }

    async connect(): Promise<void> {
        await this._transport.connect();
    }

    async disconnect(): Promise<void> {
        await this._transport.disconnect();
    }

    async initialize(): Promise<MCPServerInfo> {
        if (!this.isConnected) {
            throw new Error('Not connected to MCP server');
        }

        try {
            // Send initialize request
            const result = await this._transport.sendRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {
                    roots: {
                        listChanged: true
                    },
                    sampling: {}
                },
                clientInfo: {
                    name: 'RUV-Swarm VSCode Extension',
                    version: '0.1.0'
                }
            }, this._options.timeout);

            this._serverInfo = result;
            this._connectionInfo.serverInfo = result;

            // Send initialized notification
            await this._transport.send({
                jsonrpc: '2.0',
                method: 'notifications/initialized'
            });

            // Set logging level if supported
            if (this._serverInfo?.capabilities.logging && this._options.enableLogging) {
                await this._transport.sendRequest('logging/setLevel', {
                    level: this._options.logLevel
                }).catch(() => {
                    // Ignore errors - logging level setting is optional
                });
            }

            // Load initial data
            await Promise.all([
                this._refreshTools(),
                this._refreshResources(),
                this._refreshPrompts()
            ]);

            this._initialized = true;
            this.emit('server-info-received', this._serverInfo!);

            return this._serverInfo!;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            // eslint-disable-next-line no-throw-literal
            throw new Error(`Failed to initialize MCP client: ${String(error)}`);
        }
    }

    async ping(): Promise<void> {
        if (!this.isConnected) {
            throw new Error('Not connected to MCP server');
        }

        await this._transport.sendRequest('ping', undefined, 5000);
    }

    // Tool operations
    async listTools(): Promise<MCPTool[]> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        const result = await this._transport.sendRequest('tools/list', undefined, this._options.timeout);
        this._tools = result.tools || [];
        this.emit('tool-list-changed', this._tools);
        return this._tools;
    }

    async callTool(name: string, arguments_?: Record<string, any>): Promise<MCPToolResult> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        const tool = this._tools.find(t => t.name === name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }

        const result = await this._transport.sendRequest('tools/call', {
            name,
            arguments: arguments_ || {}
        }, this._options.timeout);

        return result;
    }

    // Resource operations
    async listResources(): Promise<MCPResource[]> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        const result = await this._transport.sendRequest('resources/list', undefined, this._options.timeout);
        this._resources = result.resources || [];
        this.emit('resource-list-changed', this._resources);
        return this._resources;
    }

    async readResource(uri: string): Promise<MCPResourceContents> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        const result = await this._transport.sendRequest('resources/read', {
            uri
        }, this._options.timeout);

        return result.contents;
    }

    async subscribeToResource(uri: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        if (!this._serverInfo?.capabilities.resources?.subscribe) {
            throw new Error('Server does not support resource subscriptions');
        }

        await this._transport.sendRequest('resources/subscribe', {
            uri
        }, this._options.timeout);
    }

    async unsubscribeFromResource(uri: string): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        if (!this._serverInfo?.capabilities.resources?.subscribe) {
            throw new Error('Server does not support resource subscriptions');
        }

        await this._transport.sendRequest('resources/unsubscribe', {
            uri
        }, this._options.timeout);
    }

    // Prompt operations
    async listPrompts(): Promise<MCPPrompt[]> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        const result = await this._transport.sendRequest('prompts/list', undefined, this._options.timeout);
        this._prompts = result.prompts || [];
        this.emit('prompt-list-changed', this._prompts);
        return this._prompts;
    }

    async getPrompt(name: string, arguments_?: Record<string, any>): Promise<MCPGetPromptResult> {
        if (!this.isInitialized) {
            throw new Error('Client not initialized');
        }

        const prompt = this._prompts.find(p => p.name === name);
        if (!prompt) {
            throw new Error(`Prompt not found: ${name}`);
        }

        const result = await this._transport.sendRequest('prompts/get', {
            name,
            arguments: arguments_ || {}
        }, this._options.timeout);

        return result;
    }

    // Utility methods
    private async _refreshTools(): Promise<void> {
        if (this._serverInfo?.capabilities.tools) {
            try {
                await this.listTools();
            } catch (error) {
                console.error('Failed to refresh tools:', error);
            }
        }
    }

    private async _refreshResources(): Promise<void> {
        if (this._serverInfo?.capabilities.resources) {
            try {
                await this.listResources();
            } catch (error) {
                console.error('Failed to refresh resources:', error);
            }
        }
    }

    private async _refreshPrompts(): Promise<void> {
        if (this._serverInfo?.capabilities.prompts) {
            try {
                await this.listPrompts();
            } catch (error) {
                console.error('Failed to refresh prompts:', error);
            }
        }
    }

    async withRetry<T>(operation: () => Promise<T>): Promise<T> {
        let lastError: Error | undefined;
        
        for (let attempt = 0; attempt <= this._options.retryAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                
                if (attempt < this._options.retryAttempts) {
                    const delay = this._options.retryDelay * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw new Error(lastError?.message || 'MCP operation failed');
    }

    dispose(): void {
        this._transport.dispose();
        this.removeAllListeners();
    }

    // Type-safe event emitter methods
    on<K extends keyof MCPClientEvents>(event: K, listener: MCPClientEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof MCPClientEvents>(event: K, ...args: Parameters<MCPClientEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}

// Factory functions for common MCP client configurations
export class MCPClientFactory {
    static createStdioClient(command: string, args?: string[], options?: MCPClientOptions & {
        env?: Record<string, string>;
        cwd?: string;
    }): MCPClient {
        const transport = MCPTransportFactory.createStdioTransport(command, args, {
            env: options?.env,
            cwd: options?.cwd
        });
        
        return new MCPClient(transport, options);
    }

    static createWebSocketClient(url: string, options?: MCPClientOptions & {
        headers?: Record<string, string>;
        protocols?: string[];
        connectionTimeout?: number;
    }): MCPClient {
        const transport = MCPTransportFactory.createWebSocketTransport(url, {
            headers: options?.headers,
            protocols: options?.protocols,
            timeout: options?.connectionTimeout
        });
        
        return new MCPClient(transport, options);
    }

    static createRUVSwarmStdioClient(ruvSwarmPath?: string, options?: MCPClientOptions): MCPClient {
        const command = ruvSwarmPath || 'ruv-swarm-mcp-stdio';
        return this.createStdioClient(command, [], options);
    }

    static createRUVSwarmWebSocketClient(port = 3000, options?: MCPClientOptions): MCPClient {
        const url = `ws://localhost:${port}/mcp`;
        return this.createWebSocketClient(url, options);
    }
}
