/**
 * MCP Manager - Manages multiple MCP clients and integrates with SwarmManager
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import * as path from 'path';
import {
    MCPServerConfig,
    MCPIntegrationConfig,
    MCPConnectionState,
    MCPServerInfo,
    MCPTool,
    MCPResource,
    MCPPrompt,
    MCPToolResult,
    MCPResourceContents,
    MCPGetPromptResult
} from './mcpTypes';
import { MCPClient, MCPClientFactory } from './mcpClient';

export interface MCPManagerEvents {
    'server-connected': (serverId: string, serverInfo: MCPServerInfo) => void;
    'server-disconnected': (serverId: string) => void;
    'server-error': (serverId: string, error: Error) => void;
    'tools-updated': (serverId: string, tools: MCPTool[]) => void;
    'resources-updated': (serverId: string, resources: MCPResource[]) => void;
    'prompts-updated': (serverId: string, prompts: MCPPrompt[]) => void;
}

export class MCPManager extends EventEmitter {
    private _clients = new Map<string, MCPClient>();
    private _config: MCPIntegrationConfig;
    private _context: vscode.ExtensionContext;
    private _statusBarItem?: vscode.StatusBarItem;
    private _outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        super();
        this._context = context;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm MCP');
        
        this._config = this._loadConfiguration();
        this._setupConfigurationWatcher();
        this._createStatusBarItem();
    }

    get isEnabled(): boolean {
        return this._config.enabled;
    }

    get connectedServers(): string[] {
        return Array.from(this._clients.keys()).filter(id => 
            this._clients.get(id)?.isConnected
        );
    }

    get allTools(): Map<string, MCPTool[]> {
        const tools = new Map<string, MCPTool[]>();
        for (const [serverId, client] of this._clients) {
            if (client.isInitialized) {
                tools.set(serverId, client.tools);
            }
        }
        return tools;
    }

    get allResources(): Map<string, MCPResource[]> {
        const resources = new Map<string, MCPResource[]>();
        for (const [serverId, client] of this._clients) {
            if (client.isInitialized) {
                resources.set(serverId, client.resources);
            }
        }
        return resources;
    }

    get allPrompts(): Map<string, MCPPrompt[]> {
        const prompts = new Map<string, MCPPrompt[]>();
        for (const [serverId, client] of this._clients) {
            if (client.isInitialized) {
                prompts.set(serverId, client.prompts);
            }
        }
        return prompts;
    }

    private _loadConfiguration(): MCPIntegrationConfig {
        const config = vscode.workspace.getConfiguration('ruv-swarm.mcp');
        
        return {
            enabled: config.get('enabled', true),
            autoConnect: config.get('autoConnect', true),
            servers: config.get('servers', this._getDefaultServers()),
            defaultTimeout: config.get('defaultTimeout', 30000),
            retryAttempts: config.get('retryAttempts', 3),
            retryDelay: config.get('retryDelay', 1000)
        };
    }

    private _getDefaultServers(): MCPServerConfig[] {
        // Try to detect RUV-Swarm MCP server automatically
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const servers: MCPServerConfig[] = [];

        // Default stdio server configuration
        servers.push({
            id: 'ruv-swarm-stdio',
            name: 'RUV-Swarm (stdio)',
            description: 'RUV-Swarm MCP server via stdio transport',
            transport: {
                type: 'stdio',
                stdio: {
                    command: 'ruv-swarm-mcp-stdio',
                    args: [],
                    cwd: workspaceRoot
                }
            },
            autoStart: true,
            enabled: true,
            priority: 1
        });

        // Default WebSocket server configuration
        servers.push({
            id: 'ruv-swarm-websocket',
            name: 'RUV-Swarm (WebSocket)',
            description: 'RUV-Swarm MCP server via WebSocket transport',
            transport: {
                type: 'websocket',
                websocket: {
                    url: 'ws://localhost:3000/mcp',
                    timeout: 30000
                }
            },
            autoStart: false,
            enabled: false,
            priority: 2
        });

        return servers;
    }

    private _setupConfigurationWatcher(): void {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.mcp')) {
                this._config = this._loadConfiguration();
                this._updateStatusBar();
                
                if (this._config.enabled) {
                    this._connectEnabledServers();
                } else {
                    this._disconnectAllServers();
                }
            }
        });
    }

    private _createStatusBarItem(): void {
        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this._statusBarItem.command = 'ruv-swarm.mcpServerStatus';
        this._updateStatusBar();
        this._statusBarItem.show();
    }

    private _updateStatusBar(): void {
        if (!this._statusBarItem) {return;}

        if (!this._config.enabled) {
            this._statusBarItem.text = '$(plug) MCP: Disabled';
            this._statusBarItem.tooltip = 'MCP integration is disabled';
            this._statusBarItem.backgroundColor = undefined;
            return;
        }

        const connectedCount = this.connectedServers.length;
        const totalCount = this._config.servers.filter(s => s.enabled).length;

        if (connectedCount === 0) {
            this._statusBarItem.text = '$(plug) MCP: Disconnected';
            this._statusBarItem.tooltip = 'No MCP servers connected';
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else if (connectedCount === totalCount) {
            this._statusBarItem.text = `$(plug) MCP: ${connectedCount} Connected`;
            this._statusBarItem.tooltip = `${connectedCount} MCP servers connected`;
            this._statusBarItem.backgroundColor = undefined;
        } else {
            this._statusBarItem.text = `$(plug) MCP: ${connectedCount}/${totalCount}`;
            this._statusBarItem.tooltip = `${connectedCount} of ${totalCount} MCP servers connected`;
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }

    async initialize(): Promise<void> {
        this._outputChannel.appendLine('Initializing MCP Manager...');
        
        if (!this._config.enabled) {
            this._outputChannel.appendLine('MCP integration is disabled');
            return;
        }

        if (this._config.autoConnect) {
            await this._connectEnabledServers();
        }

        this._outputChannel.appendLine('MCP Manager initialized');
    }

    private async _connectEnabledServers(): Promise<void> {
        const enabledServers = this._config.servers
            .filter(server => server.enabled && server.autoStart)
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));

        for (const serverConfig of enabledServers) {
            try {
                await this.connectServer(serverConfig.id);
            } catch (error) {
                this._outputChannel.appendLine(
                    `Failed to auto-connect to server ${serverConfig.id}: ${error}`
                );
            }
        }
    }

    async connectServer(serverId: string): Promise<void> {
        const serverConfig = this._config.servers.find(s => s.id === serverId);
        if (!serverConfig) {
            throw new Error(`Server configuration not found: ${serverId}`);
        }

        if (this._clients.has(serverId)) {
            const client = this._clients.get(serverId)!;
            if (client.isConnected) {
                return; // Already connected
            }
            // Dispose existing client
            client.dispose();
            this._clients.delete(serverId);
        }

        this._outputChannel.appendLine(`Connecting to MCP server: ${serverConfig.name}`);

        try {
            const client = this._createClient(serverConfig);
            this._setupClientListeners(serverId, client);
            
            this._clients.set(serverId, client);
            
            await client.connect();
            await client.initialize();
            
            this._outputChannel.appendLine(`Successfully connected to: ${serverConfig.name}`);
            this._updateStatusBar();
            
        } catch (error) {
            this._outputChannel.appendLine(
                `Failed to connect to ${serverConfig.name}: ${error}`
            );
            throw error;
        }
    }

    async disconnectServer(serverId: string): Promise<void> {
        const client = this._clients.get(serverId);
        if (!client) {
            return;
        }

        this._outputChannel.appendLine(`Disconnecting from MCP server: ${serverId}`);
        
        try {
            await client.disconnect();
            client.dispose();
            this._clients.delete(serverId);
            
            this._updateStatusBar();
            this._outputChannel.appendLine(`Disconnected from: ${serverId}`);
            
        } catch (error) {
            this._outputChannel.appendLine(`Error disconnecting from ${serverId}: ${error}`);
        }
    }

    private async _disconnectAllServers(): Promise<void> {
        const disconnectPromises = Array.from(this._clients.keys()).map(serverId =>
            this.disconnectServer(serverId)
        );
        
        await Promise.allSettled(disconnectPromises);
    }

    private _createClient(serverConfig: MCPServerConfig): MCPClient {
        const clientOptions = {
            timeout: this._config.defaultTimeout,
            retryAttempts: this._config.retryAttempts,
            retryDelay: this._config.retryDelay,
            enableLogging: true
        };

        switch (serverConfig.transport.type) {
            case 'stdio':
                return MCPClientFactory.createStdioClient(
                    serverConfig.transport.stdio!.command,
                    serverConfig.transport.stdio!.args,
                    {
                        ...clientOptions,
                        env: serverConfig.transport.stdio!.env,
                        cwd: serverConfig.transport.stdio!.cwd
                    }
                );
                
            case 'websocket':
                return MCPClientFactory.createWebSocketClient(
                    serverConfig.transport.websocket!.url,
                    {
                        ...clientOptions,
                        headers: serverConfig.transport.websocket!.headers,
                        protocols: serverConfig.transport.websocket!.protocols,
                        connectionTimeout: serverConfig.transport.websocket!.timeout
                    }
                );
                
            default:
                throw new Error(`Unsupported transport type: ${serverConfig.transport.type}`);
        }
    }

    private _setupClientListeners(serverId: string, client: MCPClient): void {
        client.on('connection-state-changed', (state: MCPConnectionState) => {
            if (state === 'connected') {
                // Will be handled by server-info-received
            } else if (state === 'disconnected') {
                this.emit('server-disconnected', serverId);
                this._updateStatusBar();
            }
        });

        client.on('server-info-received', (serverInfo: MCPServerInfo) => {
            this.emit('server-connected', serverId, serverInfo);
            this._updateStatusBar();
        });

        client.on('error', (error: Error) => {
            this.emit('server-error', serverId, error);
            this._outputChannel.appendLine(`Error from server ${serverId}: ${error.message}`);
        });

        client.on('tool-list-changed', (tools: MCPTool[]) => {
            this.emit('tools-updated', serverId, tools);
        });

        client.on('resource-list-changed', (resources: MCPResource[]) => {
            this.emit('resources-updated', serverId, resources);
        });

        client.on('prompt-list-changed', (prompts: MCPPrompt[]) => {
            this.emit('prompts-updated', serverId, prompts);
        });

        client.on('log-message', (logEntry) => {
            this._outputChannel.appendLine(
                `[${serverId}] ${logEntry.level.toUpperCase()}: ${JSON.stringify(logEntry.data)}`
            );
        });
    }

    // High-level operations that work across all connected servers
    async callTool(toolName: string, arguments_?: Record<string, any>, serverId?: string): Promise<MCPToolResult> {
        if (serverId) {
            const client = this._clients.get(serverId);
            if (!client?.isInitialized) {
                throw new Error(`Server not available: ${serverId}`);
            }
            return await client.callTool(toolName, arguments_);
        }

        // Try all connected servers
        for (const [id, client] of this._clients) {
            if (client.isInitialized && client.tools.some(t => t.name === toolName)) {
                try {
                    return await client.callTool(toolName, arguments_);
                } catch (error) {
                    this._outputChannel.appendLine(
                        `Failed to call tool ${toolName} on server ${id}: ${error}`
                    );
                    continue;
                }
            }
        }

        throw new Error(`Tool not found: ${toolName}`);
    }

    async readResource(uri: string, serverId?: string): Promise<MCPResourceContents> {
        if (serverId) {
            const client = this._clients.get(serverId);
            if (!client?.isInitialized) {
                throw new Error(`Server not available: ${serverId}`);
            }
            return await client.readResource(uri);
        }

        // Try all connected servers
        for (const [id, client] of this._clients) {
            if (client.isInitialized && client.resources.some(r => r.uri === uri)) {
                try {
                    return await client.readResource(uri);
                } catch (error) {
                    this._outputChannel.appendLine(
                        `Failed to read resource ${uri} from server ${id}: ${error}`
                    );
                    continue;
                }
            }
        }

        throw new Error(`Resource not found: ${uri}`);
    }

    async getPrompt(promptName: string, arguments_?: Record<string, any>, serverId?: string): Promise<MCPGetPromptResult> {
        if (serverId) {
            const client = this._clients.get(serverId);
            if (!client?.isInitialized) {
                throw new Error(`Server not available: ${serverId}`);
            }
            return await client.getPrompt(promptName, arguments_);
        }

        // Try all connected servers
        for (const [id, client] of this._clients) {
            if (client.isInitialized && client.prompts.some(p => p.name === promptName)) {
                try {
                    return await client.getPrompt(promptName, arguments_);
                } catch (error) {
                    this._outputChannel.appendLine(
                        `Failed to get prompt ${promptName} from server ${id}: ${error}`
                    );
                    continue;
                }
            }
        }

        throw new Error(`Prompt not found: ${promptName}`);
    }

    getServerInfo(serverId: string): MCPServerInfo | undefined {
        const client = this._clients.get(serverId);
        return client?.serverInfo;
    }

    getServerStatus(): Array<{
        id: string;
        name: string;
        state: MCPConnectionState;
        serverInfo?: MCPServerInfo;
        toolCount: number;
        resourceCount: number;
        promptCount: number;
    }> {
        return this._config.servers.map(serverConfig => {
            const client = this._clients.get(serverConfig.id);
            return {
                id: serverConfig.id,
                name: serverConfig.name,
                state: client?.connectionInfo.state || 'disconnected',
                serverInfo: client?.serverInfo,
                toolCount: client?.tools.length || 0,
                resourceCount: client?.resources.length || 0,
                promptCount: client?.prompts.length || 0
            };
        });
    }

    dispose(): void {
        this._disconnectAllServers();
        this._statusBarItem?.dispose();
        this._outputChannel.dispose();
        this.removeAllListeners();
    }

    // Type-safe event emitter methods
    on<K extends keyof MCPManagerEvents>(event: K, listener: MCPManagerEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof MCPManagerEvents>(event: K, ...args: Parameters<MCPManagerEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}
