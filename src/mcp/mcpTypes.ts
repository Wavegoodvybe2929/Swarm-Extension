/**
 * TypeScript definitions for Model Context Protocol (MCP) integration
 * Based on MCP specification and ruv-swarm-mcp implementation
 */

export interface MCPMessage {
    jsonrpc: '2.0';
    id?: string | number;
    method?: string;
    params?: any;
    result?: any;
    error?: MCPError;
}

export interface MCPError {
    code: number;
    message: string;
    data?: any;
}

export interface MCPRequest extends MCPMessage {
    method: string;
    params?: any;
}

export interface MCPResponse extends MCPMessage {
    id: string | number;
    result?: any;
    error?: MCPError;
}

export interface MCPNotification extends MCPMessage {
    method: string;
    params?: any;
}

// MCP Server Information
export interface MCPServerInfo {
    name: string;
    version: string;
    description?: string;
    author?: string;
    license?: string;
    homepage?: string;
    capabilities: MCPServerCapabilities;
}

export interface MCPServerCapabilities {
    tools?: MCPToolsCapability;
    resources?: MCPResourcesCapability;
    prompts?: MCPPromptsCapability;
    logging?: MCPLoggingCapability;
}

export interface MCPToolsCapability {
    listChanged?: boolean;
}

export interface MCPResourcesCapability {
    subscribe?: boolean;
    listChanged?: boolean;
}

export interface MCPPromptsCapability {
    listChanged?: boolean;
}

export interface MCPLoggingCapability {
    level?: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
}

// Tools
export interface MCPTool {
    name: string;
    description?: string;
    inputSchema: MCPToolInputSchema;
}

export interface MCPToolInputSchema {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}

export interface MCPToolCall {
    name: string;
    arguments?: Record<string, any>;
}

export interface MCPToolResult {
    content: MCPContent[];
    isError?: boolean;
}

// Resources
export interface MCPResource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
}

export interface MCPResourceContents {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
}

// Content types
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

export interface MCPTextContent {
    type: 'text';
    text: string;
}

export interface MCPImageContent {
    type: 'image';
    data: string;
    mimeType: string;
}

export interface MCPResourceContent {
    type: 'resource';
    resource: MCPResourceContents;
}

// Prompts
export interface MCPPrompt {
    name: string;
    description?: string;
    arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
    name: string;
    description?: string;
    required?: boolean;
}

export interface MCPPromptMessage {
    role: 'user' | 'assistant';
    content: MCPContent;
}

export interface MCPGetPromptResult {
    description?: string;
    messages: MCPPromptMessage[];
}

// Logging
export interface MCPLogEntry {
    level: 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';
    data?: any;
    logger?: string;
}

// Transport types
export type MCPTransportType = 'stdio' | 'websocket';

export interface MCPTransportConfig {
    type: MCPTransportType;
    stdio?: MCPStdioConfig;
    websocket?: MCPWebSocketConfig;
}

export interface MCPStdioConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
}

export interface MCPWebSocketConfig {
    url: string;
    headers?: Record<string, string>;
    protocols?: string[];
    timeout?: number;
}

// Connection states
export type MCPConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPConnectionInfo {
    state: MCPConnectionState;
    serverInfo?: MCPServerInfo;
    error?: string;
    connectedAt?: Date;
    lastActivity?: Date;
}

// RUV-Swarm specific extensions
export interface RUVSwarmMCPExtensions {
    swarmOperations?: {
        initializeSwarm?: boolean;
        spawnAgent?: boolean;
        analyzeCode?: boolean;
        generateTests?: boolean;
        optimizePerformance?: boolean;
    };
    neuralNetworkOps?: {
        trainModel?: boolean;
        runInference?: boolean;
        optimizeWeights?: boolean;
    };
    wasmIntegration?: {
        compileToWasm?: boolean;
        runWasmModule?: boolean;
        optimizeWasm?: boolean;
    };
}

// Event types for MCP client
export interface MCPClientEvents {
    'connection-state-changed': (state: MCPConnectionState, info: MCPConnectionInfo) => void;
    'server-info-received': (info: MCPServerInfo) => void;
    'tool-list-changed': (tools: MCPTool[]) => void;
    'resource-list-changed': (resources: MCPResource[]) => void;
    'prompt-list-changed': (prompts: MCPPrompt[]) => void;
    'log-message': (entry: MCPLogEntry) => void;
    'error': (error: Error) => void;
}

// Configuration for MCP integration
export interface MCPIntegrationConfig {
    enabled: boolean;
    autoConnect: boolean;
    servers: MCPServerConfig[];
    defaultTimeout: number;
    retryAttempts: number;
    retryDelay: number;
}

export interface MCPServerConfig {
    id: string;
    name: string;
    description?: string;
    transport: MCPTransportConfig;
    autoStart?: boolean;
    enabled?: boolean;
    priority?: number;
}

// Error codes (based on JSON-RPC 2.0 specification)
export const MCPErrorCodes = {
    // JSON-RPC 2.0 errors
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603,
    
    // MCP-specific errors
    SERVER_ERROR: -32000,
    TRANSPORT_ERROR: -32001,
    TIMEOUT_ERROR: -32002,
    AUTHENTICATION_ERROR: -32003,
    AUTHORIZATION_ERROR: -32004,
    RESOURCE_NOT_FOUND: -32005,
    TOOL_NOT_FOUND: -32006,
    PROMPT_NOT_FOUND: -32007,
} as const;

export type MCPErrorCode = typeof MCPErrorCodes[keyof typeof MCPErrorCodes];

// Utility types
export type MCPMethodName = 
    | 'initialize'
    | 'initialized'
    | 'ping'
    | 'tools/list'
    | 'tools/call'
    | 'resources/list'
    | 'resources/read'
    | 'resources/subscribe'
    | 'resources/unsubscribe'
    | 'prompts/list'
    | 'prompts/get'
    | 'logging/setLevel'
    | 'notifications/initialized'
    | 'notifications/cancelled'
    | 'notifications/progress'
    | 'notifications/resources/list_changed'
    | 'notifications/resources/updated'
    | 'notifications/tools/list_changed'
    | 'notifications/prompts/list_changed';

export interface MCPClientOptions {
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
    enableLogging?: boolean;
    logLevel?: MCPLoggingCapability['level'];
}
