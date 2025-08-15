"use strict";
/**
 * AI Workflow Orchestrator - Coordinates between LM Studio AI and swarm agents
 * Manages intelligent workflows where AI uses swarm tools for code understanding
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
exports.AIWorkflowOrchestrator = void 0;
const vscode = __importStar(require("vscode"));
const events_1 = require("events");
class AIWorkflowOrchestrator extends events_1.EventEmitter {
    constructor(context, swarmManager, lmStudioServer, toolsProvider, mcpManager) {
        super();
        this._activeWorkflows = new Map();
        this._workflowHistory = new Map();
        this._context = context;
        this._swarmManager = swarmManager;
        this._lmStudioServer = lmStudioServer;
        this._toolsProvider = toolsProvider;
        this._mcpManager = mcpManager;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm AI Workflows');
        this._config = this._loadConfiguration();
        this._setupConfigurationWatcher();
        this._setupEventListeners();
    }
    _loadConfiguration() {
        const config = vscode.workspace.getConfiguration('ruv-swarm.workflows');
        return {
            maxSteps: config.get('maxSteps', 20),
            timeout: config.get('timeout', 300000), // 5 minutes
            retryAttempts: config.get('retryAttempts', 2),
            parallelExecution: config.get('parallelExecution', true),
            contextPreservation: config.get('contextPreservation', true)
        };
    }
    _setupConfigurationWatcher() {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.workflows')) {
                this._config = this._loadConfiguration();
                this._outputChannel.appendLine('AI workflow configuration updated');
            }
        });
    }
    _setupEventListeners() {
        // Listen to LM Studio connection events
        this._lmStudioServer.on('connected', () => {
            this._outputChannel.appendLine('🤖 LM Studio connected - AI workflows enabled');
        });
        this._lmStudioServer.on('disconnected', () => {
            this._outputChannel.appendLine('⚠️ LM Studio disconnected - AI workflows paused');
        });
        // Listen to swarm events
        this._swarmManager.onSwarmEvent(event => {
            if (event.type === 'task.completed') {
                this._handleSwarmTaskCompleted(event.data);
            }
        });
    }
    /**
     * Start a comprehensive code understanding workflow
     */
    async startCodeUnderstandingWorkflow(filePaths, analysisType = 'full') {
        const sessionId = `workflow-${Date.now()}`;
        try {
            this._outputChannel.appendLine(`🚀 Starting code understanding workflow: ${sessionId}`);
            const context = {
                sessionId,
                workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                targetFiles: filePaths,
                analysisResults: new Map(),
                toolResults: new Map(),
                aiInsights: new Map(),
                metadata: {
                    analysisType,
                    startTime: Date.now(),
                    modelName: this._lmStudioServer.isConnected ? 'LM Studio' : 'Swarm Only'
                }
            };
            this._activeWorkflows.set(sessionId, context);
            this.emit('workflow-started', sessionId, context);
            // Execute workflow steps
            const result = await this._executeCodeUnderstandingSteps(context, analysisType);
            this._workflowHistory.set(sessionId, result);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-completed', sessionId, result);
            return sessionId;
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Workflow failed: ${error}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, error);
            throw error;
        }
    }
    /**
     * Start an AI-assisted coding session
     */
    async startAICodingSession(task, filePath, context) {
        if (!this._lmStudioServer.isConnected) {
            throw new Error('LM Studio not connected. Please connect to LM Studio first.');
        }
        const sessionId = `ai-session-${Date.now()}`;
        try {
            this._outputChannel.appendLine(`🤖 Starting AI coding session: ${sessionId}`);
            const workflowContext = {
                sessionId,
                workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                currentFile: filePath,
                targetFiles: filePath ? [filePath] : [],
                analysisResults: new Map(),
                toolResults: new Map(),
                aiInsights: new Map(),
                metadata: {
                    task,
                    context: context || {},
                    startTime: Date.now(),
                    sessionType: 'ai-coding'
                }
            };
            this._activeWorkflows.set(sessionId, workflowContext);
            this.emit('workflow-started', sessionId, workflowContext);
            // Execute AI coding workflow
            const result = await this._executeAICodingSteps(workflowContext, task);
            this._workflowHistory.set(sessionId, result);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-completed', sessionId, result);
            return sessionId;
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ AI coding session failed: ${error}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, error);
            throw error;
        }
    }
    /**
     * Execute project analysis workflow
     */
    async analyzeProject(scope = 'full', analysisTypes = ['structure', 'dependencies', 'quality', 'security']) {
        const sessionId = `project-analysis-${Date.now()}`;
        try {
            this._outputChannel.appendLine(`📊 Starting project analysis: ${sessionId}`);
            // Determine files to analyze based on scope
            let targetFiles = [];
            switch (scope) {
                case 'full':
                    const allFiles = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,rs,go,java,cs}', '**/node_modules/**');
                    targetFiles = allFiles.map(file => file.fsPath);
                    break;
                case 'changed-files':
                    // Would integrate with Git to get changed files
                    targetFiles = await this._getChangedFiles();
                    break;
                case 'current-file':
                    const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
                    if (activeFile) {
                        targetFiles = [activeFile];
                    }
                    break;
            }
            const context = {
                sessionId,
                workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                targetFiles,
                analysisResults: new Map(),
                toolResults: new Map(),
                aiInsights: new Map(),
                metadata: {
                    scope,
                    analysisTypes,
                    startTime: Date.now(),
                    sessionType: 'project-analysis'
                }
            };
            this._activeWorkflows.set(sessionId, context);
            this.emit('workflow-started', sessionId, context);
            const result = await this._executeProjectAnalysisSteps(context, analysisTypes);
            this._workflowHistory.set(sessionId, result);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-completed', sessionId, result);
            return sessionId;
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Project analysis failed: ${error}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, error);
            throw error;
        }
    }
    /**
     * Get workflow result by session ID
     */
    getWorkflowResult(sessionId) {
        return this._workflowHistory.get(sessionId);
    }
    /**
     * Get active workflow context
     */
    getActiveWorkflow(sessionId) {
        return this._activeWorkflows.get(sessionId);
    }
    /**
     * Cancel an active workflow
     */
    async cancelWorkflow(sessionId) {
        const context = this._activeWorkflows.get(sessionId);
        if (context) {
            this._outputChannel.appendLine(`🛑 Cancelling workflow: ${sessionId}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, new Error('Workflow cancelled by user'));
        }
    }
    // Private workflow execution methods
    async _executeCodeUnderstandingSteps(context, analysisType) {
        const startTime = Date.now();
        const steps = [];
        const results = new Map();
        const insights = [];
        const recommendations = [];
        let toolCalls = 0;
        let swarmTasks = 0;
        let cacheHits = 0;
        try {
            // Step 1: Get project structure
            const structureStep = {
                id: 'get-structure',
                type: 'tool-call',
                description: 'Get project structure and file organization',
                dependencies: [],
                parameters: { maxDepth: 3, includeFiles: true }
            };
            steps.push(structureStep);
            this.emit('step-started', context.sessionId, structureStep);
            const structureResult = await this._toolsProvider.executeTool('get_project_structure', structureStep.parameters);
            results.set(structureStep.id, structureResult);
            toolCalls++;
            this.emit('step-completed', context.sessionId, structureStep, structureResult);
            // Step 2: Analyze each target file
            for (const filePath of context.targetFiles) {
                const analyzeStep = {
                    id: `analyze-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
                    type: 'tool-call',
                    description: `Analyze file: ${filePath}`,
                    dependencies: ['get-structure'],
                    parameters: { filePath, analysisType }
                };
                steps.push(analyzeStep);
                this.emit('step-started', context.sessionId, analyzeStep);
                const analysisResult = await this._toolsProvider.executeTool('analyze_syntax', { filePath });
                results.set(analyzeStep.id, analysisResult);
                context.analysisResults.set(filePath, analysisResult);
                toolCalls++;
                this.emit('step-completed', context.sessionId, analyzeStep, analysisResult);
            }
            // Step 3: AI synthesis (if LM Studio is connected)
            if (this._lmStudioServer.isConnected && analysisType === 'full') {
                const synthesisStep = {
                    id: 'ai-synthesis',
                    type: 'ai-analysis',
                    description: 'AI synthesis of analysis results',
                    dependencies: steps.map(s => s.id),
                    parameters: {
                        analysisResults: Array.from(context.analysisResults.entries()),
                        projectStructure: results.get('get-structure')
                    }
                };
                steps.push(synthesisStep);
                this.emit('step-started', context.sessionId, synthesisStep);
                const aiSynthesis = await this._performAISynthesis(context, results);
                results.set(synthesisStep.id, aiSynthesis);
                insights.push(...aiSynthesis.insights || []);
                recommendations.push(...aiSynthesis.recommendations || []);
                this.emit('step-completed', context.sessionId, synthesisStep, aiSynthesis);
            }
            // Step 4: Generate recommendations
            const recommendationStep = {
                id: 'generate-recommendations',
                type: 'swarm-task',
                description: 'Generate improvement recommendations',
                dependencies: steps.map(s => s.id),
                parameters: { analysisResults: Array.from(results.entries()) }
            };
            steps.push(recommendationStep);
            this.emit('step-started', context.sessionId, recommendationStep);
            const swarmRecommendations = await this._swarmManager.executeTask('Generate code improvement recommendations based on analysis results', 'analysis');
            results.set(recommendationStep.id, swarmRecommendations);
            swarmTasks++;
            this.emit('step-completed', context.sessionId, recommendationStep, swarmRecommendations);
            return {
                success: true,
                steps,
                results,
                insights,
                recommendations,
                performance: {
                    totalTime: Date.now() - startTime,
                    toolCalls,
                    swarmTasks,
                    cacheHits
                }
            };
        }
        catch (error) {
            return {
                success: false,
                steps,
                results,
                insights,
                recommendations,
                performance: {
                    totalTime: Date.now() - startTime,
                    toolCalls,
                    swarmTasks,
                    cacheHits
                },
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    async _executeAICodingSteps(context, task) {
        const startTime = Date.now();
        const steps = [];
        const results = new Map();
        const insights = [];
        const recommendations = [];
        let toolCalls = 0;
        let swarmTasks = 0;
        // Implementation would include AI-guided coding steps
        // This is a simplified version showing the structure
        return {
            success: true,
            steps,
            results,
            insights,
            recommendations,
            performance: {
                totalTime: Date.now() - startTime,
                toolCalls,
                swarmTasks,
                cacheHits: 0
            }
        };
    }
    async _executeProjectAnalysisSteps(context, analysisTypes) {
        const startTime = Date.now();
        const steps = [];
        const results = new Map();
        const insights = [];
        const recommendations = [];
        let toolCalls = 0;
        let swarmTasks = 0;
        // Implementation would include comprehensive project analysis
        // This is a simplified version showing the structure
        return {
            success: true,
            steps,
            results,
            insights,
            recommendations,
            performance: {
                totalTime: Date.now() - startTime,
                toolCalls,
                swarmTasks,
                cacheHits: 0
            }
        };
    }
    async _performAISynthesis(context, results) {
        // This would use LM Studio to synthesize analysis results
        // and provide high-level insights
        const synthesisPrompt = this._buildSynthesisPrompt(context, results);
        // Would call LM Studio API here
        return {
            insights: ['AI-generated insights would appear here'],
            recommendations: ['AI-generated recommendations would appear here'],
            summary: 'AI synthesis summary would appear here'
        };
    }
    _buildSynthesisPrompt(context, results) {
        let prompt = `Analyze the following code analysis results and provide insights:\n\n`;
        prompt += `Project: ${context.workspaceRoot}\n`;
        prompt += `Files analyzed: ${context.targetFiles.length}\n\n`;
        for (const [key, result] of results) {
            prompt += `${key}:\n${JSON.stringify(result, null, 2)}\n\n`;
        }
        prompt += `Please provide:\n`;
        prompt += `1. Key insights about the codebase\n`;
        prompt += `2. Potential issues or improvements\n`;
        prompt += `3. Architecture recommendations\n`;
        prompt += `4. Security considerations\n`;
        return prompt;
    }
    async _getChangedFiles() {
        // Would integrate with Git to get changed files
        // For now, return empty array
        return [];
    }
    _handleSwarmTaskCompleted(data) {
        // Handle swarm task completion events
        this._outputChannel.appendLine(`✅ Swarm task completed: ${data.taskId}`);
    }
    dispose() {
        this._outputChannel.dispose();
        this.removeAllListeners();
        this._activeWorkflows.clear();
        this._workflowHistory.clear();
    }
    // Type-safe event emitter methods
    on(event, listener) {
        return super.on(event, listener);
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
}
exports.AIWorkflowOrchestrator = AIWorkflowOrchestrator;
//# sourceMappingURL=aiWorkflowOrchestrator.js.map