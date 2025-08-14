/**
 * MCP Manager - Manages multiple MCP clients and integrates with SwarmManager
 */
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { MCPConnectionState, MCPServerInfo, MCPTool, MCPResource, MCPPrompt, MCPToolResult, MCPResourceContents, MCPGetPromptResult } from './mcpTypes';
export interface MCPManagerEvents {
    'server-connected': (serverId: string, serverInfo: MCPServerInfo) => void;
    'server-disconnected': (serverId: string) => void;
    'server-error': (serverId: string, error: Error) => void;
    'tools-updated': (serverId: string, tools: MCPTool[]) => void;
    'resources-updated': (serverId: string, resources: MCPResource[]) => void;
    'prompts-updated': (serverId: string, prompts: MCPPrompt[]) => void;
}
export declare class MCPManager extends EventEmitter {
    private _clients;
    private _config;
    private _context;
    private _statusBarItem?;
    private _outputChannel;
    constructor(context: vscode.ExtensionContext);
    get isEnabled(): boolean;
    get connectedServers(): string[];
    get allTools(): Map<string, MCPTool[]>;
    get allResources(): Map<string, MCPResource[]>;
    get allPrompts(): Map<string, MCPPrompt[]>;
    private _loadConfiguration;
    private _getDefaultServers;
    private _setupConfigurationWatcher;
    private _createStatusBarItem;
    private _updateStatusBar;
    initialize(): Promise<void>;
    private _connectEnabledServers;
    connectServer(serverId: string): Promise<void>;
    disconnectServer(serverId: string): Promise<void>;
    private _disconnectAllServers;
    private _createClient;
    private _setupClientListeners;
    callTool(toolName: string, arguments_?: Record<string, any>, serverId?: string): Promise<MCPToolResult>;
    readResource(uri: string, serverId?: string): Promise<MCPResourceContents>;
    getPrompt(promptName: string, arguments_?: Record<string, any>, serverId?: string): Promise<MCPGetPromptResult>;
    getServerInfo(serverId: string): MCPServerInfo | undefined;
    getServerStatus(): Array<{
        id: string;
        name: string;
        state: MCPConnectionState;
        serverInfo?: MCPServerInfo;
        toolCount: number;
        resourceCount: number;
        promptCount: number;
    }>;
    dispose(): void;
    on<K extends keyof MCPManagerEvents>(event: K, listener: MCPManagerEvents[K]): this;
    emit<K extends keyof MCPManagerEvents>(event: K, ...args: Parameters<MCPManagerEvents[K]>): boolean;
}
//# sourceMappingURL=mcpManager.d.ts.map