/**
 * Swarm Tools Provider - Wraps RUV-Swarm functionality as MCP tools
 * Provides a clean interface for LM Studio AI models to interact with swarm capabilities
 */
import { SwarmManager } from '../../utils/swarmManager';
import { MCPTool, MCPToolResult } from '../mcpTypes';
export interface SwarmToolsConfig {
    enabledCategories: string[];
    maxFileSize: number;
    maxSearchResults: number;
    cacheTimeout: number;
    concurrentLimit: number;
}
export interface ToolExecutionContext {
    workspaceRoot: string;
    currentFile?: string;
    selectedText?: string;
    cursorPosition?: {
        line: number;
        character: number;
    };
}
export declare class SwarmToolsProvider {
    private _swarmManager;
    private _config;
    private _outputChannel;
    private _executionCache;
    private _activeExecutions;
    constructor(swarmManager: SwarmManager);
    private _loadConfiguration;
    private _setupConfigurationWatcher;
    /**
     * Get all available tools based on current configuration
     */
    getAvailableTools(): MCPTool[];
    /**
     * Execute a tool with the given arguments
     */
    executeTool(toolName: string, arguments_: Record<string, any>, context?: ToolExecutionContext): Promise<MCPToolResult>;
    private _getFileOperationTools;
    private _getCodeAnalysisTools;
    private _getProjectNavigationTools;
    private _getSwarmManagementTools;
    private _getSearchTools;
    private _getWorkspaceTools;
    private _getToolCategory;
    private _getDefaultContext;
    private _readFile;
    private _writeFile;
    private _listDirectory;
    private _getFileInfo;
    private _analyzeSyntax;
    private _analyzePerformance;
    private _analyzeSecurity;
    private _explainCode;
    private _getProjectStructure;
    private _findFiles;
    private _searchCode;
    private _getSwarmStatus;
    private _spawnAgent;
    private _executeSwarmTask;
    private _generateTests;
    private _codeReview;
    private _getWorkspaceInfo;
    private _getOpenFiles;
    private _getGitStatus;
    dispose(): void;
}
//# sourceMappingURL=swarmToolsProvider.d.ts.map