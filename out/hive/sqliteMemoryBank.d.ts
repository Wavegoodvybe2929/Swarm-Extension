import { Agent, SpecificationTask, HiveMemoryBank } from '../types';
export declare class SQLiteMemoryBank implements HiveMemoryBank {
    private db;
    private dbPath;
    private isInitialized;
    private maxMemorySize;
    private compressionEnabled;
    constructor(storagePath: string, maxSizeMB?: number, enableCompression?: boolean);
    initialize(): Promise<void>;
    private createTables;
    private createIndexes;
    storeSpecification(spec: SpecificationTask): Promise<void>;
    storeExecutionResult(specId: string, result: any): Promise<void>;
    storeAgentCreation(agent: Agent): Promise<void>;
    storeTaskExecution(taskId: string, agentId: string, result: any): Promise<void>;
    getCompletedTaskCount(): Promise<number>;
    getSize(): Promise<string>;
    query(query: string, limit?: number): Promise<any[]>;
    getAgentContext(agentId: string): Promise<any>;
    checkHealth(): Promise<{
        healthy: boolean;
        issues: string[];
    }>;
    storeNeuralPattern(pattern: {
        type: string;
        name: string;
        data: any;
        contextTags: string[];
    }): Promise<void>;
    getNeuralPatterns(type?: string, limit?: number): Promise<any[]>;
    storeCodePattern(pattern: {
        name: string;
        language: string;
        type: string;
        code: string;
        description: string;
        context: string;
        filePath?: string;
        tags: string[];
    }): Promise<void>;
    getCodePatterns(language?: string, type?: string, limit?: number): Promise<any[]>;
    storeErrorPattern(error: {
        type: string;
        message: string;
        context: any;
        solution?: string;
        prevention?: string;
        severity: string;
        agentId?: string;
    }): Promise<void>;
    getErrorPatterns(type?: string, severity?: string, limit?: number): Promise<any[]>;
    storeDecision(decision: {
        context: string;
        type: string;
        inputFactors: any[];
        decisionMade: string;
        confidence: number;
        agentId?: string;
    }): Promise<void>;
    storeFileChange(change: {
        filePath: string;
        changeType: string;
        agentId?: string;
        taskId?: string;
        reason?: string;
        diffData?: string;
        sizeBefore?: number;
        sizeAfter?: number;
        linesAdded?: number;
        linesRemoved?: number;
    }): Promise<void>;
    storeSwarmState(state: {
        topology: string;
        activeAgents: number;
        totalAgents: number;
        activeTasks: number;
        completedTasks: number;
        configuration: any;
        healthStatus: string;
        memoryUsage: number;
        cpuUsage: number;
    }): Promise<void>;
    getLatestSwarmState(): Promise<any>;
    private migrateFromJSON;
    private startPeriodicCleanup;
    private performCleanup;
    private ensureInitialized;
    private calculateComplexity;
    private calculateRelevance;
    dispose(): void;
}
//# sourceMappingURL=sqliteMemoryBank.d.ts.map