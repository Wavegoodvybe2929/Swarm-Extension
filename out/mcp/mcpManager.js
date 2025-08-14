"use strict";
/**
 * MCP Manager - Manages multiple MCP clients and integrates with SwarmManager
 */
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
exports.MCPManager = void 0;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
const mcpClient_1 = require("./mcpClient");
class MCPManager extends events_1.EventEmitter {
    constructor(context) {
        super();
        this._clients = new Map();
        this._context = context;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm MCP');
        this._config = this._loadConfiguration();
        this._setupConfigurationWatcher();
        this._createStatusBarItem();
    }
    get isEnabled() {
        return this._config.enabled;
    }
    get connectedServers() {
        return Array.from(this._clients.keys()).filter(id => this._clients.get(id)?.isConnected);
    }
    get allTools() {
        const tools = new Map();
        for (const [serverId, client] of this._clients) {
            if (client.isInitialized) {
                tools.set(serverId, client.tools);
            }
        }
        return tools;
    }
    get allResources() {
        const resources = new Map();
        for (const [serverId, client] of this._clients) {
            if (client.isInitialized) {
                resources.set(serverId, client.resources);
            }
        }
        return resources;
    }
    get allPrompts() {
        const prompts = new Map();
        for (const [serverId, client] of this._clients) {
            if (client.isInitialized) {
                prompts.set(serverId, client.prompts);
            }
        }
        return prompts;
    }
    _loadConfiguration() {
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
    _getDefaultServers() {
        // Try to detect RUV-Swarm MCP server automatically
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const servers = [];
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
    _setupConfigurationWatcher() {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.mcp')) {
                this._config = this._loadConfiguration();
                this._updateStatusBar();
                if (this._config.enabled) {
                    this._connectEnabledServers();
                }
                else {
                    this._disconnectAllServers();
                }
            }
        });
    }
    _createStatusBarItem() {
        this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this._statusBarItem.command = 'ruv-swarm.mcpServerStatus';
        this._updateStatusBar();
        this._statusBarItem.show();
    }
    _updateStatusBar() {
        if (!this._statusBarItem) {
            return;
        }
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
        }
        else if (connectedCount === totalCount) {
            this._statusBarItem.text = `$(plug) MCP: ${connectedCount} Connected`;
            this._statusBarItem.tooltip = `${connectedCount} MCP servers connected`;
            this._statusBarItem.backgroundColor = undefined;
        }
        else {
            this._statusBarItem.text = `$(plug) MCP: ${connectedCount}/${totalCount}`;
            this._statusBarItem.tooltip = `${connectedCount} of ${totalCount} MCP servers connected`;
            this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
    }
    async initialize() {
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
    async _connectEnabledServers() {
        const enabledServers = this._config.servers
            .filter(server => server.enabled && server.autoStart)
            .sort((a, b) => (a.priority || 0) - (b.priority || 0));
        for (const serverConfig of enabledServers) {
            try {
                await this.connectServer(serverConfig.id);
            }
            catch (error) {
                this._outputChannel.appendLine(`Failed to auto-connect to server ${serverConfig.id}: ${error}`);
            }
        }
    }
    async connectServer(serverId) {
        const serverConfig = this._config.servers.find(s => s.id === serverId);
        if (!serverConfig) {
            throw new Error(`Server configuration not found: ${serverId}`);
        }
        if (this._clients.has(serverId)) {
            const client = this._clients.get(serverId);
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
        }
        catch (error) {
            this._outputChannel.appendLine(`Failed to connect to ${serverConfig.name}: ${error}`);
            throw error;
        }
    }
    async disconnectServer(serverId) {
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
        }
        catch (error) {
            this._outputChannel.appendLine(`Error disconnecting from ${serverId}: ${error}`);
        }
    }
    async _disconnectAllServers() {
        const disconnectPromises = Array.from(this._clients.keys()).map(serverId => this.disconnectServer(serverId));
        await Promise.allSettled(disconnectPromises);
    }
    _createClient(serverConfig) {
        const clientOptions = {
            timeout: this._config.defaultTimeout,
            retryAttempts: this._config.retryAttempts,
            retryDelay: this._config.retryDelay,
            enableLogging: true
        };
        switch (serverConfig.transport.type) {
            case 'stdio':
                return mcpClient_1.MCPClientFactory.createStdioClient(serverConfig.transport.stdio.command, serverConfig.transport.stdio.args, {
                    ...clientOptions,
                    env: serverConfig.transport.stdio.env,
                    cwd: serverConfig.transport.stdio.cwd
                });
            case 'websocket':
                return mcpClient_1.MCPClientFactory.createWebSocketClient(serverConfig.transport.websocket.url, {
                    ...clientOptions,
                    headers: serverConfig.transport.websocket.headers,
                    protocols: serverConfig.transport.websocket.protocols,
                    connectionTimeout: serverConfig.transport.websocket.timeout
                });
            default:
                throw new Error(`Unsupported transport type: ${serverConfig.transport.type}`);
        }
    }
    _setupClientListeners(serverId, client) {
        client.on('connection-state-changed', (state) => {
            if (state === 'connected') {
                // Will be handled by server-info-received
            }
            else if (state === 'disconnected') {
                this.emit('server-disconnected', serverId);
                this._updateStatusBar();
            }
        });
        client.on('server-info-received', (serverInfo) => {
            this.emit('server-connected', serverId, serverInfo);
            this._updateStatusBar();
        });
        client.on('error', (error) => {
            this.emit('server-error', serverId, error);
            this._outputChannel.appendLine(`Error from server ${serverId}: ${error.message}`);
        });
        client.on('tool-list-changed', (tools) => {
            this.emit('tools-updated', serverId, tools);
        });
        client.on('resource-list-changed', (resources) => {
            this.emit('resources-updated', serverId, resources);
        });
        client.on('prompt-list-changed', (prompts) => {
            this.emit('prompts-updated', serverId, prompts);
        });
        client.on('log-message', (logEntry) => {
            this._outputChannel.appendLine(`[${serverId}] ${logEntry.level.toUpperCase()}: ${JSON.stringify(logEntry.data)}`);
        });
    }
    // High-level operations that work across all connected servers
    async callTool(toolName, arguments_, serverId) {
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
                }
                catch (error) {
                    this._outputChannel.appendLine(`Failed to call tool ${toolName} on server ${id}: ${error}`);
                    continue;
                }
            }
        }
        throw new Error(`Tool not found: ${toolName}`);
    }
    async readResource(uri, serverId) {
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
                }
                catch (error) {
                    this._outputChannel.appendLine(`Failed to read resource ${uri} from server ${id}: ${error}`);
                    continue;
                }
            }
        }
        throw new Error(`Resource not found: ${uri}`);
    }
    async getPrompt(promptName, arguments_, serverId) {
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
                }
                catch (error) {
                    this._outputChannel.appendLine(`Failed to get prompt ${promptName} from server ${id}: ${error}`);
                    continue;
                }
            }
        }
        throw new Error(`Prompt not found: ${promptName}`);
    }
    getServerInfo(serverId) {
        const client = this._clients.get(serverId);
        return client?.serverInfo;
    }
    getServerStatus() {
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
    dispose() {
        this._disconnectAllServers();
        this._statusBarItem?.dispose();
        this._outputChannel.dispose();
        this.removeAllListeners();
    }
    // Type-safe event emitter methods
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
exports.MCPManager = MCPManager;
//# sourceMappingURL=mcpManager.js.map