"use strict";
/**
 * LM Studio MCP Server - Bridges LM Studio with RUV-Swarm ecosystem
 * Enables local AI models to use swarm tools for code understanding
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
exports.LMStudioServer = void 0;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
class LMStudioServer extends events_1.EventEmitter {
    constructor(context, swarmManager) {
        super();
        this._tools = new Map();
        this._resources = new Map();
        this._toolCache = new Map();
        this._context = context;
        this._swarmManager = swarmManager;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm LM Studio');
        this._connection = {
            isConnected: false
        };
        this._config = this._loadConfiguration();
        this._initializeTools();
        this._initializeResources();
        this._setupConfigurationWatcher();
    }
    get isConnected() {
        return this._connection.isConnected;
    }
    get tools() {
        return Array.from(this._tools.values());
    }
    get resources() {
        return Array.from(this._resources.values());
    }
    get serverInfo() {
        return {
            name: 'LM Studio Bridge',
            version: '1.0.0',
            description: 'Bridges LM Studio with RUV-Swarm ecosystem',
            capabilities: {
                tools: {
                    listChanged: true
                },
                resources: {
                    subscribe: true,
                    listChanged: true
                },
                logging: {}
            }
        };
    }
    _loadConfiguration() {
        const config = vscode.workspace.getConfiguration('ruv-swarm.lmstudio');
        return {
            enabled: config.get('enabled', true),
            connection: {
                host: config.get('connection.host', 'localhost'),
                port: config.get('connection.port', 1234),
                apiKey: config.get('connection.apiKey', ''),
                timeout: config.get('connection.timeout', 30000)
            },
            model: {
                name: config.get('model.name', 'gemma-3-4b'),
                temperature: config.get('model.temperature', 0.7),
                maxTokens: config.get('model.maxTokens', 2048),
                contextWindow: config.get('model.contextWindow', 8192)
            },
            tools: {
                enabledTools: config.get('tools.enabledTools', [
                    'analyze', 'read', 'generate', 'explain', 'review', 'optimize'
                ]),
                maxConcurrentCalls: config.get('tools.maxConcurrentCalls', 3),
                toolTimeout: config.get('tools.toolTimeout', 15000)
            },
            optimization: {
                contextCompression: config.get('optimization.contextCompression', true),
                smartTruncation: config.get('optimization.smartTruncation', true),
                cacheResults: config.get('optimization.cacheResults', true)
            }
        };
    }
    _setupConfigurationWatcher() {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.lmstudio')) {
                this._config = this._loadConfiguration();
                this._outputChannel.appendLine('LM Studio configuration updated');
                if (this._config.enabled && !this._connection.isConnected) {
                    this.connect();
                }
                else if (!this._config.enabled && this._connection.isConnected) {
                    this.disconnect();
                }
            }
        });
    }
    _initializeTools() {
        const swarmTools = [
            {
                name: 'analyze_file',
                description: 'Analyze a specific file using swarm intelligence',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to analyze'
                        },
                        analysisType: {
                            type: 'string',
                            enum: ['syntax', 'logic', 'performance', 'security', 'all'],
                            description: 'Type of analysis to perform'
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'read_file_content',
                description: 'Read and return the content of a file',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to read'
                        },
                        encoding: {
                            type: 'string',
                            default: 'utf8',
                            description: 'File encoding'
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'generate_tests',
                description: 'Generate unit tests for a given file or function',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to generate tests for'
                        },
                        functionName: {
                            type: 'string',
                            description: 'Specific function to test (optional)'
                        },
                        testFramework: {
                            type: 'string',
                            enum: ['jest', 'mocha', 'pytest', 'unittest'],
                            description: 'Testing framework to use'
                        }
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
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to explain'
                        },
                        lineStart: {
                            type: 'number',
                            description: 'Starting line number (optional)'
                        },
                        lineEnd: {
                            type: 'number',
                            description: 'Ending line number (optional)'
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'code_review',
                description: 'Perform comprehensive code review using swarm agents',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to review'
                        },
                        reviewType: {
                            type: 'string',
                            enum: ['full', 'security', 'performance', 'style'],
                            description: 'Type of review to perform'
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'optimize_performance',
                description: 'Analyze and suggest performance optimizations',
                inputSchema: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Path to the file to optimize'
                        },
                        targetMetric: {
                            type: 'string',
                            enum: ['speed', 'memory', 'both'],
                            description: 'Optimization target'
                        }
                    },
                    required: ['filePath']
                }
            },
            {
                name: 'get_project_structure',
                description: 'Get the structure and overview of the current project',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeFiles: {
                            type: 'boolean',
                            default: true,
                            description: 'Include file listings'
                        },
                        maxDepth: {
                            type: 'number',
                            default: 3,
                            description: 'Maximum directory depth'
                        }
                    }
                }
            },
            {
                name: 'search_codebase',
                description: 'Search for patterns or text across the codebase',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'Search query or regex pattern'
                        },
                        fileTypes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'File extensions to search in'
                        },
                        caseSensitive: {
                            type: 'boolean',
                            default: false,
                            description: 'Case sensitive search'
                        }
                    },
                    required: ['query']
                }
            },
            {
                name: 'get_swarm_status',
                description: 'Get current status and metrics of the swarm',
                inputSchema: {
                    type: 'object',
                    properties: {
                        includeAgents: {
                            type: 'boolean',
                            default: true,
                            description: 'Include agent details'
                        },
                        includeMetrics: {
                            type: 'boolean',
                            default: true,
                            description: 'Include performance metrics'
                        }
                    }
                }
            }
        ];
        // Filter tools based on configuration
        const enabledTools = swarmTools.filter(tool => this._config.tools.enabledTools.includes(tool.name.split('_')[0]));
        enabledTools.forEach(tool => {
            this._tools.set(tool.name, tool);
        });
        this._outputChannel.appendLine(`Initialized ${enabledTools.length} swarm tools for LM Studio`);
    }
    _initializeResources() {
        const swarmResources = [
            {
                uri: 'workspace://structure',
                name: 'Project Structure',
                description: 'Current workspace structure and file organization',
                mimeType: 'application/json'
            },
            {
                uri: 'workspace://files',
                name: 'Workspace Files',
                description: 'List of all files in the workspace',
                mimeType: 'application/json'
            },
            {
                uri: 'swarm://status',
                name: 'Swarm Status',
                description: 'Current swarm status and agent information',
                mimeType: 'application/json'
            },
            {
                uri: 'swarm://metrics',
                name: 'Performance Metrics',
                description: 'Real-time swarm performance metrics',
                mimeType: 'application/json'
            },
            {
                uri: 'config://settings',
                name: 'Extension Settings',
                description: 'Current extension configuration',
                mimeType: 'application/json'
            }
        ];
        swarmResources.forEach(resource => {
            this._resources.set(resource.uri, resource);
        });
        this._outputChannel.appendLine(`Initialized ${swarmResources.length} swarm resources for LM Studio`);
    }
    async connect() {
        if (!this._config.enabled) {
            throw new Error('LM Studio integration is disabled');
        }
        try {
            this._outputChannel.appendLine('Connecting to LM Studio...');
            // Test connection to LM Studio
            const response = await this._testConnection();
            if (response.success) {
                this._connection.isConnected = true;
                this._connection.modelInfo = response.modelInfo;
                this._connection.lastPing = new Date();
                this._outputChannel.appendLine(`✅ Connected to LM Studio (${response.modelInfo?.name})`);
                this.emit('connected', this._connection.modelInfo);
                // Start health monitoring
                this._startHealthMonitoring();
            }
            else {
                throw new Error(response.error || 'Connection failed');
            }
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Failed to connect to LM Studio: ${error}`);
            this._connection.isConnected = false;
            throw error;
        }
    }
    async disconnect() {
        this._connection.isConnected = false;
        this._connection.modelInfo = undefined;
        this._outputChannel.appendLine('Disconnected from LM Studio');
        this.emit('disconnected');
    }
    async callTool(toolName, arguments_) {
        if (!this._connection.isConnected) {
            throw new Error('Not connected to LM Studio');
        }
        const tool = this._tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        // Check cache if enabled
        if (this._config.optimization.cacheResults) {
            const cacheKey = `${toolName}:${JSON.stringify(arguments_)}`;
            const cached = this._toolCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < 300000) { // 5 min cache
                this._outputChannel.appendLine(`📋 Using cached result for ${toolName}`);
                return { content: [{ type: 'text', text: JSON.stringify(cached.result) }] };
            }
        }
        try {
            this._outputChannel.appendLine(`🔧 Executing tool: ${toolName}`);
            let result;
            switch (toolName) {
                case 'analyze_file':
                    result = await this._analyzeFile(arguments_.filePath, arguments_.analysisType);
                    break;
                case 'read_file_content':
                    result = await this._readFileContent(arguments_.filePath, arguments_.encoding);
                    break;
                case 'generate_tests':
                    result = await this._generateTests(arguments_.filePath, arguments_.functionName, arguments_.testFramework);
                    break;
                case 'explain_code':
                    result = await this._explainCode(arguments_.filePath, arguments_.lineStart, arguments_.lineEnd);
                    break;
                case 'code_review':
                    result = await this._codeReview(arguments_.filePath, arguments_.reviewType);
                    break;
                case 'optimize_performance':
                    result = await this._optimizePerformance(arguments_.filePath, arguments_.targetMetric);
                    break;
                case 'get_project_structure':
                    result = await this._getProjectStructure(arguments_.includeFiles, arguments_.maxDepth);
                    break;
                case 'search_codebase':
                    result = await this._searchCodebase(arguments_.query, arguments_.fileTypes, arguments_.caseSensitive);
                    break;
                case 'get_swarm_status':
                    result = await this._getSwarmStatus(arguments_.includeAgents, arguments_.includeMetrics);
                    break;
                default:
                    throw new Error(`Unsupported tool: ${toolName}`);
            }
            // Cache result if enabled
            if (this._config.optimization.cacheResults) {
                const cacheKey = `${toolName}:${JSON.stringify(arguments_)}`;
                this._toolCache.set(cacheKey, { result, timestamp: Date.now() });
            }
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
            };
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Tool execution failed: ${error}`);
            return {
                content: [{ type: 'text', text: `Error: ${error}` }],
                isError: true
            };
        }
    }
    async readResource(uri) {
        const resource = this._resources.get(uri);
        if (!resource) {
            throw new Error(`Resource not found: ${uri}`);
        }
        try {
            let content;
            switch (uri) {
                case 'workspace://structure':
                    content = await this._getWorkspaceStructure();
                    break;
                case 'workspace://files':
                    content = await this._getWorkspaceFiles();
                    break;
                case 'swarm://status':
                    content = await this._swarmManager.getSwarmStatus();
                    break;
                case 'swarm://metrics':
                    content = await this._getSwarmMetrics();
                    break;
                case 'config://settings':
                    content = this._config;
                    break;
                default:
                    throw new Error(`Unsupported resource: ${uri}`);
            }
            return {
                uri,
                mimeType: resource.mimeType || 'application/json',
                text: JSON.stringify(content, null, 2)
            };
        }
        catch (error) {
            throw new Error(`Failed to read resource ${uri}: ${error}`);
        }
    }
    // Tool implementation methods
    async _analyzeFile(filePath, analysisType = 'all') {
        const description = `Analyze file ${filePath} for ${analysisType} issues`;
        return await this._swarmManager.executeTask(description, 'analysis', filePath);
    }
    async _readFileContent(filePath, encoding = 'utf8') {
        const fs = require('fs').promises;
        const path = require('path');
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        const fullPath = path.resolve(workspaceFolder.uri.fsPath, filePath);
        const content = await fs.readFile(fullPath, encoding);
        return {
            filePath,
            content,
            size: content.length,
            lines: content.split('\n').length
        };
    }
    async _generateTests(filePath, functionName, testFramework) {
        const description = `Generate ${testFramework || 'unit'} tests for ${filePath}${functionName ? ` function ${functionName}` : ''}`;
        return await this._swarmManager.executeTask(description, 'test_generation', filePath);
    }
    async _explainCode(filePath, lineStart, lineEnd) {
        const range = lineStart && lineEnd ? ` lines ${lineStart}-${lineEnd}` : '';
        const description = `Explain code in ${filePath}${range}`;
        return await this._swarmManager.executeTask(description, 'explanation', filePath);
    }
    async _codeReview(filePath, reviewType = 'full') {
        const description = `Perform ${reviewType} code review of ${filePath}`;
        return await this._swarmManager.executeTask(description, 'review', filePath);
    }
    async _optimizePerformance(filePath, targetMetric = 'both') {
        const description = `Optimize ${filePath} for ${targetMetric} performance`;
        return await this._swarmManager.executeTask(description, 'optimization', filePath);
    }
    async _getProjectStructure(includeFiles = true, maxDepth = 3) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        // This would implement directory traversal logic
        return {
            root: workspaceFolder.uri.fsPath,
            structure: 'Project structure would be generated here',
            includeFiles,
            maxDepth
        };
    }
    async _searchCodebase(query, fileTypes, caseSensitive = false) {
        // This would implement search logic across the codebase
        return {
            query,
            fileTypes,
            caseSensitive,
            results: 'Search results would be generated here'
        };
    }
    async _getSwarmStatus(includeAgents = true, includeMetrics = true) {
        const status = await this._swarmManager.getSwarmStatus();
        const agents = includeAgents ? this._swarmManager.getAgents() : [];
        return {
            status,
            agents: includeAgents ? agents : undefined,
            metrics: includeMetrics ? status.performance : undefined
        };
    }
    async _getWorkspaceStructure() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return {
            name: workspaceFolder?.name,
            path: workspaceFolder?.uri.fsPath,
            folders: vscode.workspace.workspaceFolders?.length || 0
        };
    }
    async _getWorkspaceFiles() {
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
        return {
            totalFiles: files.length,
            files: files.slice(0, 100).map(file => file.fsPath) // Limit for performance
        };
    }
    async _getSwarmMetrics() {
        const status = await this._swarmManager.getSwarmStatus();
        return status.performance;
    }
    async _testConnection() {
        try {
            // Test connection to LM Studio API
            const url = `http://${this._config.connection.host}:${this._config.connection.port}/v1/models`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this._config.connection.apiKey && {
                        'Authorization': `Bearer ${this._config.connection.apiKey}`
                    })
                },
                signal: AbortSignal.timeout(this._config.connection.timeout)
            });
            if (response.ok) {
                const data = await response.json();
                const models = data.data || [];
                const currentModel = models.find((m) => m.id.toLowerCase().includes(this._config.model.name.toLowerCase())) || models[0];
                return {
                    success: true,
                    modelInfo: {
                        name: currentModel?.id || 'Unknown',
                        version: '1.0.0',
                        capabilities: ['text-generation', 'tool-calling']
                    }
                };
            }
            else {
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    _startHealthMonitoring() {
        setInterval(async () => {
            if (this._connection.isConnected) {
                const health = await this._testConnection();
                if (!health.success) {
                    this._outputChannel.appendLine('⚠️ LM Studio connection lost');
                    this._connection.isConnected = false;
                    this.emit('disconnected');
                }
                else {
                    this._connection.lastPing = new Date();
                }
            }
        }, 30000); // Check every 30 seconds
    }
    dispose() {
        this.disconnect();
        this._outputChannel.dispose();
        this.removeAllListeners();
    }
}
exports.LMStudioServer = LMStudioServer;
//# sourceMappingURL=lmStudioServer.js.map