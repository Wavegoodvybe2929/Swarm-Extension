import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { 
    Agent, 
    SpecificationTask, 
    HiveMemoryBank as IHiveMemoryBank 
} from '../types';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);
const stat = promisify(fs.stat);

export class HiveMemoryBank implements IHiveMemoryBank {
    private dbPath: string;
    private memoryData: MemoryData;
    private isInitialized = false;
    private maxMemorySize: number;

    constructor(storagePath: string, maxSizeMB: number = 1024) {
        this.dbPath = path.join(storagePath, 'hive-memory.json');
        this.maxMemorySize = maxSizeMB * 1024 * 1024; // Convert to bytes
        this.memoryData = this.createEmptyMemoryData();
    }

    async initialize(): Promise<void> {
        try {
            // Ensure storage directory exists
            const storageDir = path.dirname(this.dbPath);
            try {
                await access(storageDir);
            } catch {
                await mkdir(storageDir, { recursive: true });
            }

            // Load existing data or create new
            try {
                await access(this.dbPath);
                const data = await readFile(this.dbPath, 'utf8');
                this.memoryData = JSON.parse(data);
                
                // Migrate old data structure if needed
                this.migrateDataStructure();
            } catch {
                // File doesn't exist, use empty structure
                this.memoryData = this.createEmptyMemoryData();
                await this.saveMemoryData();
            }

            this.isInitialized = true;
            
            // Start periodic cleanup
            this.startPeriodicCleanup();

        } catch (error) {
            throw new Error(`Failed to initialize memory bank: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async storeSpecification(spec: SpecificationTask): Promise<void> {
        this.ensureInitialized();
        
        const entry: SpecificationEntry = {
            id: spec.id,
            specification: spec,
            timestamp: new Date(),
            status: 'pending'
        };

        this.memoryData.specifications.set(spec.id, entry);
        await this.saveMemoryData();
    }

    async storeExecutionResult(specId: string, result: any): Promise<void> {
        this.ensureInitialized();
        
        const entry: ExecutionResultEntry = {
            id: `result-${specId}-${Date.now()}`,
            specificationId: specId,
            result,
            timestamp: new Date(),
            success: result.success,
            duration: result.duration,
            agentsUsed: result.agentsUsed
        };

        this.memoryData.executionResults.set(entry.id, entry);
        
        // Update specification status
        const specEntry = this.memoryData.specifications.get(specId);
        if (specEntry) {
            specEntry.status = result.success ? 'completed' : 'failed';
            specEntry.completedAt = new Date();
        }

        await this.saveMemoryData();
    }

    async storeAgentCreation(agent: Agent): Promise<void> {
        this.ensureInitialized();
        
        const entry: AgentEntry = {
            id: agent.id,
            agent: { ...agent },
            timestamp: new Date(),
            interactions: [],
            performance: { ...agent.performance }
        };

        this.memoryData.agents.set(agent.id, entry);
        await this.saveMemoryData();
    }

    async storeTaskExecution(taskId: string, agentId: string, result: any): Promise<void> {
        this.ensureInitialized();
        
        const entry: TaskExecutionEntry = {
            id: `task-${taskId}-${Date.now()}`,
            taskId,
            agentId,
            result,
            timestamp: new Date(),
            success: result.success,
            duration: result.duration
        };

        this.memoryData.taskExecutions.set(entry.id, entry);
        
        // Update agent interactions
        const agentEntry = this.memoryData.agents.get(agentId);
        if (agentEntry) {
            agentEntry.interactions.push({
                type: 'task_execution',
                taskId,
                timestamp: new Date(),
                success: result.success,
                duration: result.duration
            });
            
            // Update agent performance
            agentEntry.performance.tasksCompleted++;
            if (result.success) {
                const currentSuccessRate = agentEntry.performance.successRate;
                const totalTasks = agentEntry.performance.tasksCompleted;
                agentEntry.performance.successRate = 
                    (currentSuccessRate * (totalTasks - 1) + 1) / totalTasks;
            }
        }

        await this.saveMemoryData();
    }

    async getCompletedTaskCount(): Promise<number> {
        this.ensureInitialized();
        
        return Array.from(this.memoryData.taskExecutions.values())
            .filter(entry => entry.success).length;
    }

    async getSize(): Promise<string> {
        this.ensureInitialized();
        
        try {
            const stats = await stat(this.dbPath);
            const sizeInMB = stats.size / (1024 * 1024);
            return `${sizeInMB.toFixed(2)} MB`;
        } catch {
            return '0 MB';
        }
    }

    async query(query: string, limit: number = 100): Promise<any[]> {
        this.ensureInitialized();
        
        const results: any[] = [];
        const queryLower = query.toLowerCase();

        // Search specifications
        for (const [id, entry] of this.memoryData.specifications) {
            if (this.matchesQuery(entry, queryLower)) {
                results.push({
                    type: 'specification',
                    id,
                    data: entry,
                    relevance: this.calculateRelevance(entry, queryLower)
                });
            }
        }

        // Search execution results
        for (const [id, entry] of this.memoryData.executionResults) {
            if (this.matchesQuery(entry, queryLower)) {
                results.push({
                    type: 'execution_result',
                    id,
                    data: entry,
                    relevance: this.calculateRelevance(entry, queryLower)
                });
            }
        }

        // Search agents
        for (const [id, entry] of this.memoryData.agents) {
            if (this.matchesQuery(entry, queryLower)) {
                results.push({
                    type: 'agent',
                    id,
                    data: entry,
                    relevance: this.calculateRelevance(entry, queryLower)
                });
            }
        }

        // Sort by relevance and limit results
        return results
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit);
    }

    async getAgentContext(agentId: string): Promise<any> {
        this.ensureInitialized();
        
        const agentEntry = this.memoryData.agents.get(agentId);
        if (!agentEntry) {
            return null;
        }

        // Get recent interactions
        const recentInteractions = agentEntry.interactions
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10);

        // Get related task executions
        const relatedTasks = Array.from(this.memoryData.taskExecutions.values())
            .filter(entry => entry.agentId === agentId)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 5);

        return {
            agent: agentEntry.agent,
            performance: agentEntry.performance,
            recentInteractions,
            relatedTasks,
            lastActive: agentEntry.agent.lastActive
        };
    }

    async checkHealth(): Promise<{ healthy: boolean; issues: string[] }> {
        const issues: string[] = [];

        try {
            // Check if initialized
            if (!this.isInitialized) {
                issues.push('Memory bank not initialized');
            }

            // Check file accessibility
            try {
                await access(this.dbPath);
            } catch {
                issues.push('Memory bank file not accessible');
            }

            // Check memory size
            try {
                const stats = await stat(this.dbPath);
                if (stats.size > this.maxMemorySize) {
                    issues.push(`Memory bank size (${stats.size}) exceeds limit (${this.maxMemorySize})`);
                }
            } catch {
                issues.push('Cannot check memory bank size');
            }

            // Check data integrity
            const dataIntegrityIssues = this.checkDataIntegrity();
            issues.push(...dataIntegrityIssues);

        } catch (error) {
            issues.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            healthy: issues.length === 0,
            issues
        };
    }

    dispose(): void {
        // Save any pending data
        if (this.isInitialized) {
            this.saveMemoryData().catch(console.error);
        }
    }

    private createEmptyMemoryData(): MemoryData {
        return {
            version: '1.0.0',
            createdAt: new Date(),
            lastUpdated: new Date(),
            specifications: new Map(),
            executionResults: new Map(),
            agents: new Map(),
            taskExecutions: new Map(),
            patterns: new Map(),
            metadata: {
                totalSpecifications: 0,
                totalExecutions: 0,
                totalAgents: 0,
                totalTasks: 0
            }
        };
    }

    private migrateDataStructure(): void {
        // Handle data structure migrations for future versions
        if (!this.memoryData.version) {
            this.memoryData.version = '1.0.0';
        }

        // Convert plain objects to Maps if needed
        if (!(this.memoryData.specifications instanceof Map)) {
            this.memoryData.specifications = new Map(Object.entries(this.memoryData.specifications || {}));
        }
        if (!(this.memoryData.executionResults instanceof Map)) {
            this.memoryData.executionResults = new Map(Object.entries(this.memoryData.executionResults || {}));
        }
        if (!(this.memoryData.agents instanceof Map)) {
            this.memoryData.agents = new Map(Object.entries(this.memoryData.agents || {}));
        }
        if (!(this.memoryData.taskExecutions instanceof Map)) {
            this.memoryData.taskExecutions = new Map(Object.entries(this.memoryData.taskExecutions || {}));
        }
        if (!(this.memoryData.patterns instanceof Map)) {
            this.memoryData.patterns = new Map(Object.entries(this.memoryData.patterns || {}));
        }

        // Ensure metadata exists
        if (!this.memoryData.metadata) {
            this.memoryData.metadata = {
                totalSpecifications: this.memoryData.specifications.size,
                totalExecutions: this.memoryData.executionResults.size,
                totalAgents: this.memoryData.agents.size,
                totalTasks: this.memoryData.taskExecutions.size
            };
        }
    }

    private async saveMemoryData(): Promise<void> {
        try {
            this.memoryData.lastUpdated = new Date();
            
            // Update metadata
            this.memoryData.metadata.totalSpecifications = this.memoryData.specifications.size;
            this.memoryData.metadata.totalExecutions = this.memoryData.executionResults.size;
            this.memoryData.metadata.totalAgents = this.memoryData.agents.size;
            this.memoryData.metadata.totalTasks = this.memoryData.taskExecutions.size;

            // Convert Maps to objects for JSON serialization
            const serializable = {
                ...this.memoryData,
                specifications: Object.fromEntries(this.memoryData.specifications),
                executionResults: Object.fromEntries(this.memoryData.executionResults),
                agents: Object.fromEntries(this.memoryData.agents),
                taskExecutions: Object.fromEntries(this.memoryData.taskExecutions),
                patterns: Object.fromEntries(this.memoryData.patterns)
            };

            const jsonData = JSON.stringify(serializable, null, 2);
            await writeFile(this.dbPath, jsonData, 'utf8');

        } catch (error) {
            throw new Error(`Failed to save memory data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private matchesQuery(entry: any, query: string): boolean {
        const searchText = JSON.stringify(entry).toLowerCase();
        return searchText.includes(query);
    }

    private calculateRelevance(entry: any, query: string): number {
        const searchText = JSON.stringify(entry).toLowerCase();
        const queryWords = query.split(' ').filter(word => word.length > 0);
        
        let relevance = 0;
        for (const word of queryWords) {
            const occurrences = (searchText.match(new RegExp(word, 'g')) || []).length;
            relevance += occurrences;
        }
        
        return relevance;
    }

    private checkDataIntegrity(): string[] {
        const issues: string[] = [];

        try {
            // Check for orphaned references
            for (const [id, result] of this.memoryData.executionResults) {
                if (!this.memoryData.specifications.has(result.specificationId)) {
                    issues.push(`Execution result ${id} references non-existent specification ${result.specificationId}`);
                }
            }

            for (const [id, task] of this.memoryData.taskExecutions) {
                if (!this.memoryData.agents.has(task.agentId)) {
                    issues.push(`Task execution ${id} references non-existent agent ${task.agentId}`);
                }
            }

        } catch (error) {
            issues.push(`Data integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
        }

        return issues;
    }

    private startPeriodicCleanup(): void {
        // Run cleanup every hour
        setInterval(() => {
            this.performCleanup().catch(console.error);
        }, 60 * 60 * 1000);
    }

    private async performCleanup(): Promise<void> {
        try {
            const now = new Date();
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

            // Clean old execution results
            for (const [id, entry] of this.memoryData.executionResults) {
                if (now.getTime() - entry.timestamp.getTime() > maxAge) {
                    this.memoryData.executionResults.delete(id);
                }
            }

            // Clean old task executions
            for (const [id, entry] of this.memoryData.taskExecutions) {
                if (now.getTime() - entry.timestamp.getTime() > maxAge) {
                    this.memoryData.taskExecutions.delete(id);
                }
            }

            // Clean old agent interactions
            for (const [id, entry] of this.memoryData.agents) {
                entry.interactions = entry.interactions.filter(interaction => 
                    now.getTime() - interaction.timestamp.getTime() <= maxAge
                );
            }

            await this.saveMemoryData();

        } catch (error) {
            console.error('Memory cleanup failed:', error);
        }
    }

    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Memory bank not initialized');
        }
    }
}

// Supporting interfaces
interface MemoryData {
    version: string;
    createdAt: Date;
    lastUpdated: Date;
    specifications: Map<string, SpecificationEntry>;
    executionResults: Map<string, ExecutionResultEntry>;
    agents: Map<string, AgentEntry>;
    taskExecutions: Map<string, TaskExecutionEntry>;
    patterns: Map<string, PatternEntry>;
    metadata: {
        totalSpecifications: number;
        totalExecutions: number;
        totalAgents: number;
        totalTasks: number;
    };
}

interface SpecificationEntry {
    id: string;
    specification: SpecificationTask;
    timestamp: Date;
    status: 'pending' | 'running' | 'completed' | 'failed';
    completedAt?: Date;
}

interface ExecutionResultEntry {
    id: string;
    specificationId: string;
    result: any;
    timestamp: Date;
    success: boolean;
    duration: number;
    agentsUsed: number;
}

interface AgentEntry {
    id: string;
    agent: Agent;
    timestamp: Date;
    interactions: AgentInteraction[];
    performance: {
        tasksCompleted: number;
        successRate: number;
        averageResponseTime: number;
        tokenEfficiency: number;
        accuracy: number;
    };
}

interface TaskExecutionEntry {
    id: string;
    taskId: string;
    agentId: string;
    result: any;
    timestamp: Date;
    success: boolean;
    duration: number;
}

interface PatternEntry {
    id: string;
    pattern: any;
    timestamp: Date;
    usage: number;
    success: number;
}

interface AgentInteraction {
    type: 'task_execution' | 'coordination' | 'communication';
    taskId?: string;
    timestamp: Date;
    success: boolean;
    duration: number;
    metadata?: any;
}
