import { Agent, SpecificationTask, HiveMemoryBank as IHiveMemoryBank } from '../types';
export declare class HiveMemoryBank implements IHiveMemoryBank {
    private dbPath;
    private memoryData;
    private isInitialized;
    private maxMemorySize;
    constructor(storagePath: string, maxSizeMB?: number);
    initialize(): Promise<void>;
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
    dispose(): void;
    private createEmptyMemoryData;
    private migrateDataStructure;
    private saveMemoryData;
    private matchesQuery;
    private calculateRelevance;
    private checkDataIntegrity;
    private startPeriodicCleanup;
    private performCleanup;
    private ensureInitialized;
}
//# sourceMappingURL=hiveMemoryBank.d.ts.map