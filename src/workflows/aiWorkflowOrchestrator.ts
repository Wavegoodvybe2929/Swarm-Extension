/**
 * AI Workflow Orchestrator - Coordinates between LM Studio AI and swarm agents
 * Manages intelligent workflows where AI uses swarm tools for code understanding
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { SwarmManager } from '../utils/swarmManager';
import { LMStudioServer } from '../mcp/servers/lmStudioServer';
import { SwarmToolsProvider } from '../mcp/tools/swarmToolsProvider';
import { MCPManager } from '../mcp/mcpManager';

export interface WorkflowConfig {
    maxSteps: number;
    timeout: number;
    retryAttempts: number;
    parallelExecution: boolean;
    contextPreservation: boolean;
}

export interface WorkflowStep {
    id: string;
    type: 'tool-call' | 'ai-analysis' | 'swarm-task' | 'context-update';
    description: string;
    dependencies: string[];
    parameters: Record<string, any>;
    timeout?: number;
    retryable?: boolean;
}

export interface WorkflowContext {
    sessionId: string;
    workspaceRoot: string;
    currentFile?: string;
    targetFiles: string[];
    analysisResults: Map<string, any>;
    toolResults: Map<string, any>;
    aiInsights: Map<string, any>;
    metadata: Record<string, any>;
}

export interface WorkflowResult {
    success: boolean;
    steps: WorkflowStep[];
    results: Map<string, any>;
    insights: string[];
    recommendations: string[];
    performance: {
        totalTime: number;
        toolCalls: number;
        swarmTasks: number;
        cacheHits: number;
    };
    errors?: string[];
}

export interface AIWorkflowEvents {
    'workflow-started': (sessionId: string, context: WorkflowContext) => void;
    'workflow-completed': (sessionId: string, result: WorkflowResult) => void;
    'workflow-failed': (sessionId: string, error: Error) => void;
    'step-started': (sessionId: string, step: WorkflowStep) => void;
    'step-completed': (sessionId: string, step: WorkflowStep, result: any) => void;
    'context-updated': (sessionId: string, context: WorkflowContext) => void;
}

export class AIWorkflowOrchestrator extends EventEmitter {
    private _swarmManager: SwarmManager;
    private _lmStudioServer: LMStudioServer;
    private _toolsProvider: SwarmToolsProvider;
    private _mcpManager: MCPManager;
    private _context: vscode.ExtensionContext;
    private _outputChannel: vscode.OutputChannel;
    private _config: WorkflowConfig;
    private _activeWorkflows: Map<string, WorkflowContext> = new Map();
    private _workflowHistory: Map<string, WorkflowResult> = new Map();

    constructor(
        context: vscode.ExtensionContext,
        swarmManager: SwarmManager,
        lmStudioServer: LMStudioServer,
        toolsProvider: SwarmToolsProvider,
        mcpManager: MCPManager
    ) {
        super();
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

    private _loadConfiguration(): WorkflowConfig {
        const config = vscode.workspace.getConfiguration('ruv-swarm.workflows');
        
        return {
            maxSteps: config.get('maxSteps', 20),
            timeout: config.get('timeout', 300000), // 5 minutes
            retryAttempts: config.get('retryAttempts', 2),
            parallelExecution: config.get('parallelExecution', true),
            contextPreservation: config.get('contextPreservation', true)
        };
    }

    private _setupConfigurationWatcher(): void {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.workflows')) {
                this._config = this._loadConfiguration();
                this._outputChannel.appendLine('AI workflow configuration updated');
            }
        });
    }

    private _setupEventListeners(): void {
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
    async startCodeUnderstandingWorkflow(
        filePaths: string[],
        analysisType: 'full' | 'focused' | 'security' | 'performance' = 'full'
    ): Promise<string> {
        const sessionId = `workflow-${Date.now()}`;
        
        try {
            this._outputChannel.appendLine(`🚀 Starting code understanding workflow: ${sessionId}`);
            
            const context: WorkflowContext = {
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

        } catch (error) {
            this._outputChannel.appendLine(`❌ Workflow failed: ${error}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, error as Error);
            throw error;
        }
    }

    /**
     * Start an AI-assisted coding session
     */
    async startAICodingSession(
        task: string,
        filePath?: string,
        context?: Record<string, any>
    ): Promise<string> {
        if (!this._lmStudioServer.isConnected) {
            throw new Error('LM Studio not connected. Please connect to LM Studio first.');
        }

        const sessionId = `ai-session-${Date.now()}`;
        
        try {
            this._outputChannel.appendLine(`🤖 Starting AI coding session: ${sessionId}`);
            
            const workflowContext: WorkflowContext = {
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

        } catch (error) {
            this._outputChannel.appendLine(`❌ AI coding session failed: ${error}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, error as Error);
            throw error;
        }
    }

    /**
     * Execute project analysis workflow
     */
    async analyzeProject(
        scope: 'full' | 'changed-files' | 'current-file' = 'full',
        analysisTypes: string[] = ['structure', 'dependencies', 'quality', 'security']
    ): Promise<string> {
        const sessionId = `project-analysis-${Date.now()}`;
        
        try {
            this._outputChannel.appendLine(`📊 Starting project analysis: ${sessionId}`);
            
            // Determine files to analyze based on scope
            let targetFiles: string[] = [];
            
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

            const context: WorkflowContext = {
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

        } catch (error) {
            this._outputChannel.appendLine(`❌ Project analysis failed: ${error}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, error as Error);
            throw error;
        }
    }

    /**
     * Get workflow result by session ID
     */
    getWorkflowResult(sessionId: string): WorkflowResult | undefined {
        return this._workflowHistory.get(sessionId);
    }

    /**
     * Get active workflow context
     */
    getActiveWorkflow(sessionId: string): WorkflowContext | undefined {
        return this._activeWorkflows.get(sessionId);
    }

    /**
     * Cancel an active workflow
     */
    async cancelWorkflow(sessionId: string): Promise<void> {
        const context = this._activeWorkflows.get(sessionId);
        if (context) {
            this._outputChannel.appendLine(`🛑 Cancelling workflow: ${sessionId}`);
            this._activeWorkflows.delete(sessionId);
            this.emit('workflow-failed', sessionId, new Error('Workflow cancelled by user'));
        }
    }

    // Private workflow execution methods
    private async _executeCodeUnderstandingSteps(
        context: WorkflowContext,
        analysisType: string
    ): Promise<WorkflowResult> {
        const startTime = Date.now();
        const steps: WorkflowStep[] = [];
        const results = new Map<string, any>();
        const insights: string[] = [];
        const recommendations: string[] = [];
        let toolCalls = 0;
        let swarmTasks = 0;
        let cacheHits = 0;

        try {
            // Step 1: Get project structure
            const structureStep: WorkflowStep = {
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
                const analyzeStep: WorkflowStep = {
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
                const synthesisStep: WorkflowStep = {
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
            const recommendationStep: WorkflowStep = {
                id: 'generate-recommendations',
                type: 'swarm-task',
                description: 'Generate improvement recommendations',
                dependencies: steps.map(s => s.id),
                parameters: { analysisResults: Array.from(results.entries()) }
            };
            
            steps.push(recommendationStep);
            this.emit('step-started', context.sessionId, recommendationStep);
            
            const swarmRecommendations = await this._swarmManager.executeTask(
                'Generate code improvement recommendations based on analysis results',
                'analysis'
            );
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

        } catch (error) {
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

    private async _executeAICodingSteps(
        context: WorkflowContext,
        task: string
    ): Promise<WorkflowResult> {
        const startTime = Date.now();
        const steps: WorkflowStep[] = [];
        const results = new Map<string, any>();
        const insights: string[] = [];
        const recommendations: string[] = [];
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

    private async _executeProjectAnalysisSteps(
        context: WorkflowContext,
        analysisTypes: string[]
    ): Promise<WorkflowResult> {
        const startTime = Date.now();
        const steps: WorkflowStep[] = [];
        const results = new Map<string, any>();
        const insights: string[] = [];
        const recommendations: string[] = [];
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

    private async _performAISynthesis(
        context: WorkflowContext,
        results: Map<string, any>
    ): Promise<any> {
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

    private _buildSynthesisPrompt(
        context: WorkflowContext,
        results: Map<string, any>
    ): string {
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

    private async _getChangedFiles(): Promise<string[]> {
        // Would integrate with Git to get changed files
        // For now, return empty array
        return [];
    }

    private _handleSwarmTaskCompleted(data: any): void {
        // Handle swarm task completion events
        this._outputChannel.appendLine(`✅ Swarm task completed: ${data.taskId}`);
    }

    dispose(): void {
        this._outputChannel.dispose();
        this.removeAllListeners();
        this._activeWorkflows.clear();
        this._workflowHistory.clear();
    }

    // Type-safe event emitter methods
    on<K extends keyof AIWorkflowEvents>(event: K, listener: AIWorkflowEvents[K]): this {
        return super.on(event, listener);
    }

    emit<K extends keyof AIWorkflowEvents>(event: K, ...args: Parameters<AIWorkflowEvents[K]>): boolean {
        return super.emit(event, ...args);
    }
}
