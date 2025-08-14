export interface SwarmConfig {
    topology: 'hierarchical' | 'mesh' | 'ring' | 'star';
    maxAgents: number;
    cognitivePatterns: CognitivePattern[];
    enableMLOptimization: boolean;
    enableWASM: boolean;
    enableSIMD: boolean;
}
export type CognitivePattern = 'convergent' | 'divergent' | 'systems' | 'critical' | 'lateral' | 'abstract' | 'hybrid';
export interface Agent {
    id: string;
    name: string;
    type: AgentType;
    model: string;
    cognitivePattern: CognitivePattern;
    capabilities: string[];
    status: AgentStatus;
    performance: AgentPerformance;
    createdAt: Date;
    lastActive: Date;
}
export type AgentType = 'researcher' | 'coder' | 'analyst' | 'optimizer' | 'coordinator' | 'tester' | 'reviewer';
export type AgentStatus = 'idle' | 'active' | 'busy' | 'error' | 'offline';
export interface AgentPerformance {
    tasksCompleted: number;
    successRate: number;
    averageResponseTime: number;
    tokenEfficiency: number;
    accuracy: number;
}
export interface Task {
    id: string;
    description: string;
    type: TaskType;
    status: TaskStatus;
    assignedAgents: string[];
    priority: TaskPriority;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    result?: TaskResult;
    metadata: TaskMetadata;
}
export type TaskType = 'analysis' | 'generation' | 'optimization' | 'review' | 'testing' | 'refactoring' | 'explanation';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export interface TaskResult {
    success: boolean;
    output: string;
    metrics: TaskMetrics;
    suggestions?: string[];
    diagnostics?: Diagnostic[];
}
export interface TaskMetrics {
    duration: number;
    tokenUsage: number;
    tokenSavings: number;
    qualityScore: number;
    confidenceScore: number;
}
export interface TaskMetadata {
    filePath?: string;
    language?: string;
    framework?: string;
    lineRange?: [number, number];
    context?: string;
}
export interface Diagnostic {
    severity: DiagnosticSeverity;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    code?: string;
    source: string;
    category: DiagnosticCategory;
}
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';
export type DiagnosticCategory = 'syntax' | 'logic' | 'performance' | 'security' | 'maintainability' | 'style';
export interface SwarmStatus {
    isInitialized: boolean;
    isRunning: boolean;
    topology: string;
    activeAgents: number;
    totalAgents: number;
    activeTasks: number;
    completedTasks: number;
    performance: SwarmPerformance;
    health: SwarmHealth;
}
export interface SwarmPerformance {
    tasksPerSecond: number;
    averageResponseTime: number;
    tokenEfficiency: number;
    successRate: number;
    cpuUsage: number;
    memoryUsage: number;
}
export interface SwarmHealth {
    status: 'healthy' | 'degraded' | 'critical' | 'offline';
    issues: string[];
    lastHealthCheck: Date;
}
export interface AnalysisResult {
    filePath: string;
    language: string;
    timestamp: Date;
    overallScore: number;
    categories: {
        codeQuality: CategoryResult;
        performance: CategoryResult;
        security: CategoryResult;
        maintainability: CategoryResult;
    };
    suggestions: Suggestion[];
    diagnostics: Diagnostic[];
    metrics: AnalysisMetrics;
}
export interface CategoryResult {
    score: number;
    issues: Issue[];
    improvements: string[];
}
export interface Issue {
    severity: DiagnosticSeverity;
    message: string;
    line: number;
    column: number;
    rule?: string;
    fixable: boolean;
}
export interface Suggestion {
    type: 'improvement' | 'optimization' | 'refactoring' | 'fix';
    priority: TaskPriority;
    description: string;
    location?: {
        line: number;
        column: number;
        endLine?: number;
        endColumn?: number;
    };
    code?: string;
    estimatedImpact: 'low' | 'medium' | 'high';
}
export interface AnalysisMetrics {
    linesAnalyzed: number;
    processingTime: number;
    tokensUsed: number;
    agentsInvolved: number;
    confidenceLevel: number;
}
export interface ExtensionConfig {
    enabled: boolean;
    autoInitialize: boolean;
    defaultTopology: string;
    maxAgents: number;
    cognitivePatterns: string[];
    autoAnalyze: {
        enabled: boolean;
        onSave: boolean;
        onOpen: boolean;
        debounceMs: number;
    };
    fileWatcher: {
        enabled: boolean;
        patterns: string[];
        exclude: string[];
    };
    terminal: {
        showOutput: boolean;
        clearOnRun: boolean;
        focusOnRun: boolean;
    };
}
export interface CommandContext {
    workspaceFolder?: string;
    activeEditor?: {
        filePath: string;
        language: string;
        selection?: {
            start: {
                line: number;
                character: number;
            };
            end: {
                line: number;
                character: number;
            };
        };
        text?: string;
    };
    config: ExtensionConfig;
}
export interface WebviewMessage {
    type: string;
    payload: any;
    timestamp: Date;
}
export interface DashboardData {
    swarmStatus: SwarmStatus;
    agents: Agent[];
    recentTasks: Task[];
    recentAnalysis: AnalysisResult[];
    performance: SwarmPerformance;
}
export interface SwarmEvent {
    type: SwarmEventType;
    timestamp: Date;
    data: any;
}
export type SwarmEventType = 'swarm.initialized' | 'swarm.shutdown' | 'agent.spawned' | 'agent.terminated' | 'task.started' | 'task.completed' | 'task.failed' | 'analysis.completed' | 'performance.updated';
export declare class SwarmError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class AgentError extends SwarmError {
    agentId: string;
    constructor(message: string, agentId: string, details?: any);
}
export declare class TaskError extends SwarmError {
    taskId: string;
    constructor(message: string, taskId: string, details?: any);
}
//# sourceMappingURL=index.d.ts.map