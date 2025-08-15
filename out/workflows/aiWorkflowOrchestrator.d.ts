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
export declare class AIWorkflowOrchestrator extends EventEmitter {
    private _swarmManager;
    private _lmStudioServer;
    private _toolsProvider;
    private _mcpManager;
    private _context;
    private _outputChannel;
    private _config;
    private _activeWorkflows;
    private _workflowHistory;
    constructor(context: vscode.ExtensionContext, swarmManager: SwarmManager, lmStudioServer: LMStudioServer, toolsProvider: SwarmToolsProvider, mcpManager: MCPManager);
    private _loadConfiguration;
    private _setupConfigurationWatcher;
    private _setupEventListeners;
    /**
     * Start a comprehensive code understanding workflow
     */
    startCodeUnderstandingWorkflow(filePaths: string[], analysisType?: 'full' | 'focused' | 'security' | 'performance'): Promise<string>;
    /**
     * Start an AI-assisted coding session
     */
    startAICodingSession(task: string, filePath?: string, context?: Record<string, any>): Promise<string>;
    /**
     * Execute project analysis workflow
     */
    analyzeProject(scope?: 'full' | 'changed-files' | 'current-file', analysisTypes?: string[]): Promise<string>;
    /**
     * Get workflow result by session ID
     */
    getWorkflowResult(sessionId: string): WorkflowResult | undefined;
    /**
     * Get active workflow context
     */
    getActiveWorkflow(sessionId: string): WorkflowContext | undefined;
    /**
     * Cancel an active workflow
     */
    cancelWorkflow(sessionId: string): Promise<void>;
    private _executeCodeUnderstandingSteps;
    private _executeAICodingSteps;
    private _executeProjectAnalysisSteps;
    private _performAISynthesis;
    private _buildSynthesisPrompt;
    private _getChangedFiles;
    private _handleSwarmTaskCompleted;
    dispose(): void;
    on<K extends keyof AIWorkflowEvents>(event: K, listener: AIWorkflowEvents[K]): this;
    emit<K extends keyof AIWorkflowEvents>(event: K, ...args: Parameters<AIWorkflowEvents[K]>): boolean;
}
//# sourceMappingURL=aiWorkflowOrchestrator.d.ts.map