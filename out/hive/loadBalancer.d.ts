import * as vscode from 'vscode';
import { Agent, Task } from '../types';
import { TopologyManager } from './topologyManager';
export interface LoadBalancingConfig {
    strategy: 'round_robin' | 'least_loaded' | 'capability_based' | 'performance_based' | 'adaptive';
    maxLoadPerAgent: number;
    rebalanceThreshold: number;
    considerCapabilities: boolean;
    considerPerformance: boolean;
    enablePredictiveBalancing: boolean;
}
export interface AgentLoad {
    agentId: string;
    currentLoad: number;
    maxCapacity: number;
    utilizationRate: number;
    queuedTasks: number;
    averageTaskDuration: number;
    capabilities: string[];
    performance: AgentPerformanceMetrics;
}
export interface AgentPerformanceMetrics {
    successRate: number;
    averageResponseTime: number;
    tokenEfficiency: number;
    accuracy: number;
    reliability: number;
    specialization: Map<string, number>;
}
export interface TaskAssignment {
    taskId: string;
    agentId: string;
    estimatedDuration: number;
    confidence: number;
    reasoning: string;
}
export interface LoadBalancingMetrics {
    totalTasks: number;
    activeTasks: number;
    queuedTasks: number;
    averageWaitTime: number;
    loadVariance: number;
    throughput: number;
    efficiency: number;
}
export declare class LoadBalancer implements vscode.Disposable {
    private config;
    private agentLoads;
    private taskQueue;
    private assignmentHistory;
    private topologyManager;
    private outputChannel;
    private rebalanceTimer?;
    private metrics;
    constructor(topologyManager: TopologyManager, config?: Partial<LoadBalancingConfig>);
    initializeAgents(agents: Agent[]): Promise<void>;
    assignTask(task: Task): Promise<TaskAssignment>;
    completeTask(taskId: string, agentId: string, success: boolean, duration: number): Promise<void>;
    rebalanceLoad(): Promise<void>;
    getLoadBalancingMetrics(): Promise<LoadBalancingMetrics>;
    getAgentLoads(): AgentLoad[];
    getAgentLoad(agentId: string): AgentLoad | undefined;
    predictOptimalAssignment(task: Task): Promise<TaskAssignment[]>;
    private findOptimalAgent;
    private rankAgentsForTask;
    private calculateAssignmentScore;
    private calculateCapabilityMatch;
    private calculatePerformanceScore;
    private calculateSpecializationScore;
    private getRequiredCapabilities;
    private getPriorityMultiplier;
    private estimateTaskDuration;
    private getTaskComplexityMultiplier;
    private generateAssignmentReasoning;
    private updateAgentLoad;
    private calculateMaxCapacity;
    private calculateReliability;
    private calculateSpecialization;
    private calculateLoadVariance;
    private findOverloadedAgents;
    private findUnderloadedAgents;
    private selectBestUnderloadedAgent;
    private updateMovingAverage;
    private updateMetrics;
    private startPeriodicRebalancing;
    dispose(): void;
}
//# sourceMappingURL=loadBalancer.d.ts.map