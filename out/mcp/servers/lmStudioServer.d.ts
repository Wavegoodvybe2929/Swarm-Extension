/**
 * LM Studio MCP Server - Bridges LM Studio with RUV-Swarm ecosystem
 * Enables local AI models to use swarm tools for code understanding
 */
import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { SwarmManager } from '../../utils/swarmManager';
import { MCPTool, MCPResource, MCPToolResult, MCPResourceContents, MCPServerInfo } from '../mcpTypes';
export interface LMStudioConfig {
    enabled: boolean;
    connection: {
        host: string;
        port: number;
        apiKey?: string;
        timeout: number;
    };
    model: {
        name: string;
        temperature: number;
        maxTokens: number;
        contextWindow: number;
    };
    tools: {
        enabledTools: string[];
        maxConcurrentCalls: number;
        toolTimeout: number;
    };
    optimization: {
        contextCompression: boolean;
        smartTruncation: boolean;
        cacheResults: boolean;
    };
}
export interface LMStudioConnection {
    isConnected: boolean;
    modelInfo?: {
        name: string;
        version: string;
        capabilities: string[];
    };
    lastPing?: Date;
}
export declare class LMStudioServer extends EventEmitter {
    private _config;
    private _connection;
    private _swarmManager;
    private _context;
    private _outputChannel;
    private _tools;
    private _resources;
    private _toolCache;
    constructor(context: vscode.ExtensionContext, swarmManager: SwarmManager);
    get isConnected(): boolean;
    get tools(): MCPTool[];
    get resources(): MCPResource[];
    get serverInfo(): MCPServerInfo;
    private _loadConfiguration;
    private _setupConfigurationWatcher;
    private _initializeTools;
    private _initializeResources;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    callTool(toolName: string, arguments_: Record<string, any>): Promise<MCPToolResult>;
    readResource(uri: string): Promise<MCPResourceContents>;
    private _analyzeFile;
    private _readFileContent;
    private _generateTests;
    private _explainCode;
    private _codeReview;
    private _optimizePerformance;
    private _getProjectStructure;
    private _searchCodebase;
    private _getSwarmStatus;
    private _getWorkspaceStructure;
    private _getWorkspaceFiles;
    private _getSwarmMetrics;
    private _testConnection;
    private _startHealthMonitoring;
    dispose(): void;
}
//# sourceMappingURL=lmStudioServer.d.ts.map