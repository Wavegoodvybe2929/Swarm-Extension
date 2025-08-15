/**
 * Swarm Tools Provider - Wraps RUV-Swarm functionality as MCP tools
 * Provides a clean interface for LM Studio AI models to interact with swarm capabilities
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
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
    cursorPosition?: { line: number; character: number };
}

export class SwarmToolsProvider {
    private _swarmManager: SwarmManager;
    private _config: SwarmToolsConfig;
    private _outputChannel: vscode.OutputChannel;
    private _executionCache: Map<string, { result: any; timestamp: number }> = new Map();
    private _activeExecutions: Set<string> = new Set();

    constructor(swarmManager: SwarmManager) {
        this._swarmManager = swarmManager;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm Tools');
        this._config = this._loadConfiguration();
        this._setupConfigurationWatcher();
    }

    private _loadConfiguration(): SwarmToolsConfig {
        const config = vscode.workspace.getConfiguration('ruv-swarm.tools');
        
        return {
            enabledCategories: config.get('enabledCategories', [
                'file-operations', 'code-analysis', 'project-navigation', 'swarm-management'
            ]),
            maxFileSize: config.get('maxFileSize', 1024 * 1024), // 1MB
            maxSearchResults: config.get('maxSearchResults', 100),
            cacheTimeout: config.get('cacheTimeout', 300000), // 5 minutes
            concurrentLimit: config.get('concurrentLimit', 5)
        };
    }

    private _setupConfigurationWatcher(): void {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.tools')) {
                this._config = this._loadConfiguration();
                this._outputChannel.appendLine('Swarm tools configuration updated');
            }
        });
    }

    /**
     * Get all available tools based on current configuration
     */
    getAvailableTools(): MCPTool[] {
        const allTools: MCPTool[] = [
            // File Operations
            ...this._getFileOperationTools(),
            // Code Analysis
            ...this._getCodeAnalysisTools(),
            // Project Navigation
            ...this._getProjectNavigationTools(),
            // Swarm Management
            ...this._getSwarmManagementTools(),
            // Search and Discovery
            ...this._getSearchTools(),
            // Context and Workspace
            ...this._getWorkspaceTools()
        ];

        // Filter based on enabled categories
        return allTools.filter(tool => {
            const category = this._getToolCategory(tool.name);
            return this._config.enabledCategories.includes(category);
        });
    }

    /**
     * Execute a tool with the given arguments
     */
    async executeTool(toolName: string, arguments_: Record<string, any>, context?: ToolExecutionContext): Promise<MCPToolResult> {
        // Check concurrent execution limit
        if (this._activeExecutions.size >= this._config.concurrentLimit) {
            throw new Error('Maximum concurrent tool executions reached');
        }

        // Check cache first
        const cacheKey = `${toolName}:${JSON.stringify(arguments_)}`;
        const cached = this._executionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this._config.cacheTimeout) {
            this._outputChannel.appendLine(`📋 Using cached result for ${toolName}`);
            return { content: [{ type: 'text', text: JSON.stringify(cached.result, null, 2) }] };
        }

        const executionId = `${toolName}-${Date.now()}`;
        this._activeExecutions.add(executionId);

        try {
            this._outputChannel.appendLine(`🔧 Executing tool: ${toolName}`);
            
            let result: any;
            const executionContext = context || await this._getDefaultContext();

            switch (toolName) {
                // File Operations
                case 'read_file':
                    result = await this._readFile(arguments_.filePath, arguments_.encoding, executionContext);
                    break;
                case 'write_file':
                    result = await this._writeFile(arguments_.filePath, arguments_.content, executionContext);
                    break;
                case 'list_directory':
                    result = await this._listDirectory(arguments_.dirPath, arguments_.recursive, executionContext);
                    break;
                case 'get_file_info':
                    result = await this._getFileInfo(arguments_.filePath, executionContext);
                    break;

                // Code Analysis
                case 'analyze_syntax':
                    result = await this._analyzeSyntax(arguments_.filePath, executionContext);
                    break;
                case 'analyze_performance':
                    result = await this._analyzePerformance(arguments_.filePath, arguments_.targetMetric, executionContext);
                    break;
                case 'analyze_security':
                    result = await this._analyzeSecurity(arguments_.filePath, executionContext);
                    break;
                case 'explain_code':
                    result = await this._explainCode(arguments_.filePath, arguments_.lineStart, arguments_.lineEnd, executionContext);
                    break;

                // Project Navigation
                case 'get_project_structure':
                    result = await this._getProjectStructure(arguments_.maxDepth, arguments_.includeFiles, executionContext);
                    break;
                case 'find_files':
                    result = await this._findFiles(arguments_.pattern, arguments_.exclude, executionContext);
                    break;
                case 'search_code':
                    result = await this._searchCode(arguments_.query, arguments_.fileTypes, arguments_.caseSensitive, executionContext);
                    break;

                // Swarm Management
                case 'get_swarm_status':
                    result = await this._getSwarmStatus(arguments_.includeAgents, arguments_.includeMetrics);
                    break;
                case 'spawn_agent':
                    result = await this._spawnAgent(arguments_.type, arguments_.name, arguments_.capabilities);
                    break;
                case 'execute_swarm_task':
                    result = await this._executeSwarmTask(arguments_.description, arguments_.type, arguments_.filePath);
                    break;

                // Test Generation
                case 'generate_tests':
                    result = await this._generateTests(arguments_.filePath, arguments_.functionName, arguments_.testFramework, executionContext);
                    break;

                // Code Review
                case 'code_review':
                    result = await this._codeReview(arguments_.filePath, arguments_.reviewType, executionContext);
                    break;

                // Workspace Tools
                case 'get_workspace_info':
                    result = await this._getWorkspaceInfo();
                    break;
                case 'get_open_files':
                    result = await this._getOpenFiles();
                    break;
                case 'get_git_status':
                    result = await this._getGitStatus(executionContext);
                    break;

                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }

            // Cache the result
            this._executionCache.set(cacheKey, { result, timestamp: Date.now() });

            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };

        } catch (error) {
            this._outputChannel.appendLine(`❌ Tool execution failed: ${error}`);
            return {
                content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        } finally {
            this._activeExecutions.delete(executionId);
        }
    }

    // Tool category definitions
    private _getFileOperationTools(): MCPTool[] {
        return [
            {
                name: 'read_file',
                description: 'Read the contents of a file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to read' },
                        encoding: { type: 'string', default: 'utf8', description: 'File encoding' }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'write_file',
                description: 'Write content to a file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to write' },
                        content: { type: 'string', description: 'Content to write to the file' }
                    },
                    required: ['filePath', 'content']
                }
            },
            {
                name: 'list_directory',
                description: 'List contents of a directory',
                inputSchema: {
                    type: 'object',
                    properties: {
                        dirPath: { type: 'string', description: 'Path to the directory' },
                        recursive: { type: 'boolean', default: false, description: 'List recursively' }
                    },
                    required: ['dirPath']
                }
            },
            {
                name: 'get_file_info',
                description: 'Get information about a file (size, modified date, etc.)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file' }
                    },
                    required: ['filePath']
                }
            }
        ];
    }

    private _getCodeAnalysisTools(): MCPTool[] {
        return [
            {
                name: 'analyze_syntax',
                description: 'Analyze code syntax and structure',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to analyze' }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'analyze_performance',
                description: 'Analyze code for performance issues',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to analyze' },
                        targetMetric: { 
                            type: 'string', 
                            enum: ['speed', 'memory', 'both'], 
                            default: 'both',
                            description: 'Performance metric to focus on' 
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'analyze_security',
                description: 'Analyze code for security vulnerabilities',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to analyze' }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'explain_code',
                description: 'Get detailed explanation of code functionality',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file' },
                        lineStart: { type: 'number', description: 'Starting line number (optional)' },
                        lineEnd: { type: 'number', description: 'Ending line number (optional)' }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'generate_tests',
                description: 'Generate unit tests for code',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to test' },
                        functionName: { type: 'string', description: 'Specific function to test (optional)' },
                        testFramework: { 
                            type: 'string', 
                            enum: ['jest', 'mocha', 'pytest', 'unittest', 'auto'],
                            default: 'auto',
                            description: 'Testing framework to use' 
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'code_review',
                description: 'Perform comprehensive code review',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: { type: 'string', description: 'Path to the file to review' },
                        reviewType: { 
                            type: 'string', 
                            enum: ['full', 'security', 'performance', 'style', 'maintainability'],
                            default: 'full',
                            description: 'Type of review to perform' 
                        }
                    },
                    required: ['filePath']
                }
            }
        ];
    }

    private _getProjectNavigationTools(): MCPTool[] {
        return [
            {
                name: 'get_project_structure',
                description: 'Get the structure of the current project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        maxDepth: { type: 'number', default: 3, description: 'Maximum directory depth' },
                        includeFiles: { type: 'boolean', default: true, description: 'Include file listings' }
                    }
                }
            },
            {
                name: 'find_files',
                description: 'Find files matching a pattern',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: { type: 'string', description: 'File pattern to search for' },
                        exclude: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'Patterns to exclude' 
                        }
                    },
                    required: ['pattern']
                }
            },
            {
                name: 'search_code',
                description: 'Search for text or patterns in code',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query or regex pattern' },
                        fileTypes: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'File extensions to search in' 
                        },
                        caseSensitive: { type: 'boolean', default: false, description: 'Case sensitive search' }
                    },
                    required: ['query']
                }
            }
        ];
    }

    private _getSwarmManagementTools(): MCPTool[] {
        return [
            {
                name: 'get_swarm_status',
                description: 'Get current swarm status and metrics',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeAgents: { type: 'boolean', default: true, description: 'Include agent details' },
                        includeMetrics: { type: 'boolean', default: true, description: 'Include performance metrics' }
                    }
                }
            },
            {
                name: 'spawn_agent',
                description: 'Spawn a new swarm agent',
                inputSchema: {
                    type: 'object',
                    properties: {
                        type: { 
                            type: 'string', 
                            enum: ['coder', 'tester', 'reviewer', 'optimizer'],
                            description: 'Type of agent to spawn' 
                        },
                        name: { type: 'string', description: 'Name for the agent (optional)' },
                        capabilities: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'Specific capabilities for the agent' 
                        }
                    },
                    required: ['type']
                }
            },
            {
                name: 'execute_swarm_task',
                description: 'Execute a task using the swarm',
                inputSchema: {
                    type: 'object',
                    properties: {
                        description: { type: 'string', description: 'Task description' },
                        type: { 
                            type: 'string', 
                            enum: ['analysis', 'generation', 'optimization', 'review'],
                            default: 'analysis',
                            description: 'Type of task' 
                        },
                        filePath: { type: 'string', description: 'File to operate on (optional)' }
                    },
                    required: ['description']
                }
            }
        ];
    }

    private _getSearchTools(): MCPTool[] {
        return [
            // Search tools are included in project navigation
        ];
    }

    private _getWorkspaceTools(): MCPTool[] {
        return [
            {
                name: 'get_workspace_info',
                description: 'Get information about the current workspace',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'get_open_files',
                description: 'Get list of currently open files in the editor',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            },
            {
                name: 'get_git_status',
                description: 'Get Git repository status',
                inputSchema: {
                    type: 'object',
                    properties: {}
                }
            }
        ];
    }

    private _getToolCategory(toolName: string): string {
        if (['read_file', 'write_file', 'list_directory', 'get_file_info'].includes(toolName)) {
            return 'file-operations';
        }
        if (['analyze_syntax', 'analyze_performance', 'analyze_security', 'explain_code', 'generate_tests', 'code_review'].includes(toolName)) {
            return 'code-analysis';
        }
        if (['get_project_structure', 'find_files', 'search_code'].includes(toolName)) {
            return 'project-navigation';
        }
        if (['get_swarm_status', 'spawn_agent', 'execute_swarm_task'].includes(toolName)) {
            return 'swarm-management';
        }
        if (['get_workspace_info', 'get_open_files', 'get_git_status'].includes(toolName)) {
            return 'workspace';
        }
        return 'other';
    }

    private async _getDefaultContext(): Promise<ToolExecutionContext> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const activeEditor = vscode.window.activeTextEditor;
        
        return {
            workspaceRoot: workspaceFolder?.uri.fsPath || '',
            currentFile: activeEditor?.document.uri.fsPath,
            selectedText: activeEditor?.document.getText(activeEditor.selection),
            cursorPosition: activeEditor?.selection.active ? {
                line: activeEditor.selection.active.line,
                character: activeEditor.selection.active.character
            } : undefined
        };
    }

    // Tool implementation methods
    private async _readFile(filePath: string, encoding: string = 'utf8', context: ToolExecutionContext): Promise<any> {
        const fullPath = path.resolve(context.workspaceRoot, filePath);
        const stats = await fs.stat(fullPath);
        
        if (stats.size > this._config.maxFileSize) {
            throw new Error(`File too large: ${stats.size} bytes (max: ${this._config.maxFileSize})`);
        }
        
        const content = await fs.readFile(fullPath, { encoding: encoding as BufferEncoding });
        
        return {
            filePath,
            content,
            size: stats.size,
            lines: content.split('\n').length,
            encoding,
            lastModified: stats.mtime
        };
    }

    private async _writeFile(filePath: string, content: string, context: ToolExecutionContext): Promise<any> {
        const fullPath = path.resolve(context.workspaceRoot, filePath);
        await fs.writeFile(fullPath, content, 'utf8');
        
        return {
            filePath,
            bytesWritten: Buffer.byteLength(content, 'utf8'),
            success: true
        };
    }

    private async _listDirectory(dirPath: string, recursive: boolean = false, context: ToolExecutionContext): Promise<any> {
        const fullPath = path.resolve(context.workspaceRoot, dirPath);
        
        if (recursive) {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(fullPath, '**/*'),
                '**/node_modules/**'
            );
            return {
                path: dirPath,
                files: files.map(file => path.relative(fullPath, file.fsPath)),
                recursive: true
            };
        } else {
            const entries = await fs.readdir(fullPath, { withFileTypes: true });
            return {
                path: dirPath,
                entries: entries.map(entry => ({
                    name: entry.name,
                    type: entry.isDirectory() ? 'directory' : 'file'
                })),
                recursive: false
            };
        }
    }

    private async _getFileInfo(filePath: string, context: ToolExecutionContext): Promise<any> {
        const fullPath = path.resolve(context.workspaceRoot, filePath);
        const stats = await fs.stat(fullPath);
        
        return {
            filePath,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            lastModified: stats.mtime,
            created: stats.birthtime,
            permissions: stats.mode
        };
    }

    private async _analyzeSyntax(filePath: string, context: ToolExecutionContext): Promise<any> {
        const description = `Analyze syntax and structure of ${filePath}`;
        return await this._swarmManager.executeTask(description, 'analysis', filePath);
    }

    private async _analyzePerformance(filePath: string, targetMetric: string = 'both', context: ToolExecutionContext): Promise<any> {
        const description = `Analyze ${filePath} for ${targetMetric} performance issues`;
        return await this._swarmManager.executeTask(description, 'optimization', filePath);
    }

    private async _analyzeSecurity(filePath: string, context: ToolExecutionContext): Promise<any> {
        const description = `Analyze ${filePath} for security vulnerabilities`;
        return await this._swarmManager.executeTask(description, 'analysis', filePath);
    }

    private async _explainCode(filePath: string, lineStart?: number, lineEnd?: number, context?: ToolExecutionContext): Promise<any> {
        const range = lineStart && lineEnd ? ` lines ${lineStart}-${lineEnd}` : '';
        const description = `Explain code in ${filePath}${range}`;
        return await this._swarmManager.executeTask(description, 'explanation', filePath);
    }

    private async _getProjectStructure(maxDepth: number = 3, includeFiles: boolean = true, context: ToolExecutionContext): Promise<any> {
        // Implementation would traverse directory structure
        return {
            root: context.workspaceRoot,
            maxDepth,
            includeFiles,
            structure: 'Project structure would be generated here'
        };
    }

    private async _findFiles(pattern: string, exclude: string[] = [], context: ToolExecutionContext): Promise<any> {
        const files = await vscode.workspace.findFiles(
            pattern,
            `{${exclude.join(',')}}`
        );
        
        return {
            pattern,
            exclude,
            files: files.slice(0, this._config.maxSearchResults).map(file => 
                path.relative(context.workspaceRoot, file.fsPath)
            ),
            totalFound: files.length,
            limited: files.length > this._config.maxSearchResults
        };
    }

    private async _searchCode(query: string, fileTypes?: string[], caseSensitive: boolean = false, context?: ToolExecutionContext): Promise<any> {
        // Implementation would search across codebase
        return {
            query,
            fileTypes,
            caseSensitive,
            results: 'Search results would be generated here'
        };
    }

    private async _getSwarmStatus(includeAgents: boolean = true, includeMetrics: boolean = true): Promise<any> {
        const status = await this._swarmManager.getSwarmStatus();
        const agents = includeAgents ? this._swarmManager.getAgents() : [];
        
        return {
            status,
            agents: includeAgents ? agents : undefined,
            metrics: includeMetrics ? status.performance : undefined
        };
    }

    private async _spawnAgent(type: string, name?: string, capabilities?: string[]): Promise<any> {
        return await this._swarmManager.spawnAgent(type, name, capabilities);
    }

    private async _executeSwarmTask(description: string, type: string = 'analysis', filePath?: string): Promise<any> {
        return await this._swarmManager.executeTask(description, type, filePath);
    }

    private async _generateTests(filePath: string, functionName?: string, testFramework?: string, context?: ToolExecutionContext): Promise<any> {
        const description = `Generate ${testFramework || 'unit'} tests for ${filePath}${functionName ? ` function ${functionName}` : ''}`;
        return await this._swarmManager.executeTask(description, 'test_generation', filePath);
    }

    private async _codeReview(filePath: string, reviewType: string = 'full', context?: ToolExecutionContext): Promise<any> {
        const description = `Perform ${reviewType} code review of ${filePath}`;
        return await this._swarmManager.executeTask(description, 'review', filePath);
    }

    private async _getWorkspaceInfo(): Promise<any> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return {
            folders: workspaceFolders?.map(folder => ({
                name: folder.name,
                path: folder.uri.fsPath
            })) || [],
            activeFolder: workspaceFolders?.[0]?.name
        };
    }

    private async _getOpenFiles(): Promise<any> {
        const openFiles = vscode.workspace.textDocuments
            .filter(doc => !doc.isUntitled)
            .map(doc => ({
                path: doc.uri.fsPath,
                language: doc.languageId,
                isDirty: doc.isDirty,
                lineCount: doc.lineCount
            }));
            
        return {
            files: openFiles,
            count: openFiles.length
        };
    }

    private async _getGitStatus(context: ToolExecutionContext): Promise<any> {
        // Implementation would check Git status
        return {
            repository: context.workspaceRoot,
            status: 'Git status would be checked here'
        };
    }

    dispose(): void {
        this._outputChannel.dispose();
        this._executionCache.clear();
        this._activeExecutions.clear();
    }
}
