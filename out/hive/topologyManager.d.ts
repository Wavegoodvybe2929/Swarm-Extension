import * as vscode from 'vscode';
import { Agent, Task, HiveConfig } from '../types';
export type CoordinationTopology = 'mesh' | 'hierarchical' | 'ring' | 'star';
export type CoordinationStrategy = 'parallel' | 'sequential' | 'adaptive' | 'hybrid';
export interface TopologyConfig {
    type: CoordinationTopology;
    maxAgents: number;
    loadBalancingEnabled: boolean;
    faultToleranceEnabled: boolean;
    autoOptimization: boolean;
}
export interface CoordinationMetrics {
    efficiency: number;
    latency: number;
    throughput: number;
    faultTolerance: number;
    scalability: number;
}
export interface TopologyNode {
    agentId: string;
    connections: string[];
    role: 'coordinator' | 'worker' | 'bridge';
    load: number;
    status: 'active' | 'busy' | 'idle' | 'error';
}
export declare class TopologyManager implements vscode.Disposable {
    private currentTopology;
    private topologyConfig;
    private nodes;
    private connections;
    private metrics;
    private outputChannel;
    private isOptimizing;
    constructor(config: HiveConfig);
    initializeTopology(agents: Agent[]): Promise<void>;
    switchTopology(newTopology: CoordinationTopology, agents: Agent[]): Promise<void>;
    addAgent(agent: Agent): Promise<void>;
    removeAgent(agentId: string): Promise<void>;
    getOptimalStrategy(task: Task): Promise<CoordinationStrategy>;
    getCoordinationPath(fromAgent: string, toAgent: string): Promise<string[]>;
    optimizeTopology(): Promise<void>;
    getTopologyMetrics(): CoordinationMetrics;
    getTopologyVisualization(): any;
    private buildTopologyConnections;
    private buildMeshTopology;
    private buildHierarchicalTopology;
    private buildRingTopology;
    private buildStarTopology;
    private determineNodeRole;
    private calculateTaskComplexity;
    private calculateAverageLoad;
    private findDirectPath;
    private findHierarchicalPath;
    private findRingPath;
    private findStarPath;
    private calculateMetrics;
    private calculateLoadVariance;
    private calculateAveragePathLength;
    private findShortestPath;
    private calculateParallelCapability;
    private calculateRedundancy;
    private calculateScalability;
    private updateMetrics;
    private calculateOverallScore;
    private generateOptimizations;
    private simulateOptimization;
    private applyOptimization;
    private rebalanceLoad;
    private optimizeConnections;
    private promoteToCoordinator;
    dispose(): void;
}
//# sourceMappingURL=topologyManager.d.ts.map