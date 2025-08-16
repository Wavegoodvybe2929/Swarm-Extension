import * as vscode from 'vscode';
import { Agent, Task, TaskPriority } from '../types';
import { TopologyManager, CoordinationStrategy } from './topologyManager';

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
    specialization: Map<string, number>; // capability -> proficiency score
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

export class LoadBalancer implements vscode.Disposable {
    private config: LoadBalancingConfig;
    private agentLoads: Map<string, AgentLoad> = new Map();
    private taskQueue: Map<string, Task> = new Map();
    private assignmentHistory: Map<string, TaskAssignment[]> = new Map();
    private topologyManager: TopologyManager;
    private outputChannel: vscode.OutputChannel;
    private rebalanceTimer?: NodeJS.Timeout;
    private metrics: LoadBalancingMetrics;

    constructor(topologyManager: TopologyManager, config?: Partial<LoadBalancingConfig>) {
        this.topologyManager = topologyManager;
        this.config = {
            strategy: 'adaptive',
            maxLoadPerAgent: 10,
            rebalanceThreshold: 0.3,
            considerCapabilities: true,
            considerPerformance: true,
            enablePredictiveBalancing: true,
            ...config
        };

        this.metrics = {
            totalTasks: 0,
            activeTasks: 0,
            queuedTasks: 0,
            averageWaitTime: 0,
            loadVariance: 0,
            throughput: 0,
            efficiency: 0
        };

        this.outputChannel = vscode.window.createOutputChannel('Load Balancer');
        this.startPeriodicRebalancing();
    }

    async initializeAgents(agents: Agent[]): Promise<void> {
        try {
            this.outputChannel.appendLine(`⚖️ Initializing load balancer with ${agents.length} agents`);

            this.agentLoads.clear();

            for (const agent of agents) {
                const agentLoad: AgentLoad = {
                    agentId: agent.id,
                    currentLoad: 0,
                    maxCapacity: this.calculateMaxCapacity(agent),
                    utilizationRate: 0,
                    queuedTasks: 0,
                    averageTaskDuration: 0,
                    capabilities: agent.capabilities,
                    performance: {
                        successRate: agent.performance.successRate,
                        averageResponseTime: agent.performance.averageResponseTime,
                        tokenEfficiency: agent.performance.tokenEfficiency,
                        accuracy: agent.performance.accuracy,
                        reliability: this.calculateReliability(agent),
                        specialization: this.calculateSpecialization(agent)
                    }
                };

                this.agentLoads.set(agent.id, agentLoad);
                this.assignmentHistory.set(agent.id, []);
            }

            this.outputChannel.appendLine(`✅ Load balancer initialized successfully`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize load balancer: ${error}`);
            throw error;
        }
    }

    async assignTask(task: Task): Promise<TaskAssignment> {
        try {
            this.outputChannel.appendLine(`📋 Assigning task ${task.id} (${task.type}, priority: ${task.priority})`);

            // Find the best agent for this task
            const assignment = await this.findOptimalAgent(task);

            if (!assignment) {
                throw new Error(`No suitable agent found for task ${task.id}`);
            }

            // Update agent load
            await this.updateAgentLoad(assignment.agentId, task);

            // Store assignment
            const history = this.assignmentHistory.get(assignment.agentId) || [];
            history.push(assignment);
            this.assignmentHistory.set(assignment.agentId, history);

            // Update metrics
            this.metrics.totalTasks++;
            this.metrics.activeTasks++;
            await this.updateMetrics();

            this.outputChannel.appendLine(`✅ Task ${task.id} assigned to agent ${assignment.agentId} (confidence: ${(assignment.confidence * 100).toFixed(1)}%)`);

            return assignment;

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to assign task ${task.id}: ${error}`);
            throw error;
        }
    }

    async completeTask(taskId: string, agentId: string, success: boolean, duration: number): Promise<void> {
        try {
            const agentLoad = this.agentLoads.get(agentId);
            if (!agentLoad) {
                throw new Error(`Agent ${agentId} not found in load balancer`);
            }

            // Update agent load
            agentLoad.currentLoad = Math.max(0, agentLoad.currentLoad - 1);
            agentLoad.utilizationRate = agentLoad.currentLoad / agentLoad.maxCapacity;

            // Update performance metrics
            if (success) {
                agentLoad.performance.successRate = this.updateMovingAverage(
                    agentLoad.performance.successRate, 1.0, 0.1
                );
            } else {
                agentLoad.performance.successRate = this.updateMovingAverage(
                    agentLoad.performance.successRate, 0.0, 0.1
                );
            }

            agentLoad.performance.averageResponseTime = this.updateMovingAverage(
                agentLoad.performance.averageResponseTime, duration, 0.1
            );

            // Update average task duration
            agentLoad.averageTaskDuration = this.updateMovingAverage(
                agentLoad.averageTaskDuration, duration, 0.1
            );

            // Update metrics
            this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
            await this.updateMetrics();

            this.outputChannel.appendLine(`✅ Task ${taskId} completed by agent ${agentId} (success: ${success}, duration: ${duration}ms)`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to complete task ${taskId}: ${error}`);
            throw error;
        }
    }

    async rebalanceLoad(): Promise<void> {
        if (this.agentLoads.size === 0) {return;}

        try {
            this.outputChannel.appendLine(`⚖️ Rebalancing load across ${this.agentLoads.size} agents`);

            const loadVariance = this.calculateLoadVariance();
            
            if (loadVariance < this.config.rebalanceThreshold) {
                this.outputChannel.appendLine(`ℹ️ Load variance (${loadVariance.toFixed(3)}) below threshold, no rebalancing needed`);
                return;
            }

            // Find overloaded and underloaded agents
            const overloadedAgents = this.findOverloadedAgents();
            const underloadedAgents = this.findUnderloadedAgents();

            if (overloadedAgents.length === 0 || underloadedAgents.length === 0) {
                this.outputChannel.appendLine(`ℹ️ No agents available for rebalancing`);
                return;
            }

            // Redistribute tasks from overloaded to underloaded agents
            let redistributed = 0;
            for (const overloadedAgent of overloadedAgents) {
                const tasksToMove = Math.ceil((overloadedAgent.currentLoad - overloadedAgent.maxCapacity) / 2);
                
                for (let i = 0; i < tasksToMove && underloadedAgents.length > 0; i++) {
                    const targetAgent = this.selectBestUnderloadedAgent(underloadedAgents, overloadedAgent.capabilities);
                    
                    if (targetAgent && targetAgent.currentLoad < targetAgent.maxCapacity) {
                        // Simulate task movement
                        overloadedAgent.currentLoad--;
                        targetAgent.currentLoad++;
                        redistributed++;
                        
                        // Update utilization rates
                        overloadedAgent.utilizationRate = overloadedAgent.currentLoad / overloadedAgent.maxCapacity;
                        targetAgent.utilizationRate = targetAgent.currentLoad / targetAgent.maxCapacity;
                    }
                }
            }

            await this.updateMetrics();
            this.outputChannel.appendLine(`✅ Rebalancing completed - redistributed ${redistributed} tasks`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Load rebalancing failed: ${error}`);
        }
    }

    async getLoadBalancingMetrics(): Promise<LoadBalancingMetrics> {
        await this.updateMetrics();
        return { ...this.metrics };
    }

    getAgentLoads(): AgentLoad[] {
        return Array.from(this.agentLoads.values());
    }

    getAgentLoad(agentId: string): AgentLoad | undefined {
        return this.agentLoads.get(agentId);
    }

    async predictOptimalAssignment(task: Task): Promise<TaskAssignment[]> {
        // Return top 3 agent candidates with their assignment predictions
        const candidates = await this.rankAgentsForTask(task);
        return candidates.slice(0, 3);
    }

    private async findOptimalAgent(task: Task): Promise<TaskAssignment | null> {
        const candidates = await this.rankAgentsForTask(task);
        
        if (candidates.length === 0) {
            return null;
        }

        return candidates[0];
    }

    private async rankAgentsForTask(task: Task): Promise<TaskAssignment[]> {
        const candidates: TaskAssignment[] = [];

        for (const [agentId, agentLoad] of this.agentLoads) {
            // Skip agents that are at capacity
            if (agentLoad.currentLoad >= agentLoad.maxCapacity) {
                continue;
            }

            const score = await this.calculateAssignmentScore(task, agentLoad);
            const estimatedDuration = this.estimateTaskDuration(task, agentLoad);

            candidates.push({
                taskId: task.id,
                agentId: agentId,
                estimatedDuration: estimatedDuration,
                confidence: score,
                reasoning: this.generateAssignmentReasoning(task, agentLoad, score)
            });
        }

        // Sort by confidence score (descending)
        return candidates.sort((a, b) => b.confidence - a.confidence);
    }

    private async calculateAssignmentScore(task: Task, agentLoad: AgentLoad): Promise<number> {
        let score = 0.0;

        // Base score from agent availability (lower load = higher score)
        const availabilityScore = 1.0 - agentLoad.utilizationRate;
        score += availabilityScore * 0.3;

        // Capability matching score
        if (this.config.considerCapabilities) {
            const capabilityScore = this.calculateCapabilityMatch(task, agentLoad);
            score += capabilityScore * 0.4;
        }

        // Performance score
        if (this.config.considerPerformance) {
            const performanceScore = this.calculatePerformanceScore(agentLoad);
            score += performanceScore * 0.3;
        }

        // Task type specialization
        const specializationScore = this.calculateSpecializationScore(task, agentLoad);
        score += specializationScore * 0.2;

        // Priority adjustment
        const priorityMultiplier = this.getPriorityMultiplier(task.priority);
        score *= priorityMultiplier;

        return Math.min(1.0, Math.max(0.0, score));
    }

    private calculateCapabilityMatch(task: Task, agentLoad: AgentLoad): number {
        // Simple capability matching based on task type and agent capabilities
        const requiredCapabilities = this.getRequiredCapabilities(task);
        const matchedCapabilities = requiredCapabilities.filter(cap => 
            agentLoad.capabilities.includes(cap)
        );

        return requiredCapabilities.length > 0 ? 
            matchedCapabilities.length / requiredCapabilities.length : 0.5;
    }

    private calculatePerformanceScore(agentLoad: AgentLoad): number {
        // Weighted combination of performance metrics
        return (
            agentLoad.performance.successRate * 0.4 +
            (1.0 - Math.min(agentLoad.performance.averageResponseTime / 10000, 1.0)) * 0.2 +
            agentLoad.performance.tokenEfficiency * 0.2 +
            agentLoad.performance.accuracy * 0.1 +
            agentLoad.performance.reliability * 0.1
        );
    }

    private calculateSpecializationScore(task: Task, agentLoad: AgentLoad): number {
        const taskType = task.type;
        const specialization = agentLoad.performance.specialization.get(taskType) || 0.5;
        return specialization;
    }

    private getRequiredCapabilities(task: Task): string[] {
        // Map task types to required capabilities
        const capabilityMap: Record<string, string[]> = {
            'analysis': ['code-analysis', 'pattern-recognition'],
            'generation': ['code-generation', 'creativity'],
            'optimization': ['performance-optimization', 'refactoring'],
            'review': ['code-review', 'quality-assurance'],
            'testing': ['test-generation', 'quality-assurance'],
            'refactoring': ['refactoring', 'code-optimization'],
            'explanation': ['documentation', 'communication']
        };

        return capabilityMap[task.type] || [];
    }

    private getPriorityMultiplier(priority: TaskPriority): number {
        const multipliers = {
            'critical': 1.5,
            'high': 1.2,
            'medium': 1.0,
            'low': 0.8
        };

        return multipliers[priority] || 1.0;
    }

    private estimateTaskDuration(task: Task, agentLoad: AgentLoad): number {
        // Base estimation on agent's average task duration and task complexity
        const baseTime = agentLoad.averageTaskDuration || 5000; // Default 5 seconds
        const complexityMultiplier = this.getTaskComplexityMultiplier(task);
        const loadMultiplier = 1.0 + (agentLoad.utilizationRate * 0.5); // Higher load = longer duration

        return Math.round(baseTime * complexityMultiplier * loadMultiplier);
    }

    private getTaskComplexityMultiplier(task: Task): number {
        const complexityMap = {
            'analysis': 1.2,
            'generation': 1.5,
            'optimization': 1.8,
            'review': 1.0,
            'testing': 1.3,
            'refactoring': 1.6,
            'explanation': 0.8
        };

        return complexityMap[task.type] || 1.0;
    }

    private generateAssignmentReasoning(task: Task, agentLoad: AgentLoad, score: number): string {
        const reasons = [];

        if (agentLoad.utilizationRate < 0.5) {
            reasons.push('low current load');
        }

        const capabilityMatch = this.calculateCapabilityMatch(task, agentLoad);
        if (capabilityMatch > 0.7) {
            reasons.push('strong capability match');
        }

        if (agentLoad.performance.successRate > 0.8) {
            reasons.push('high success rate');
        }

        if (agentLoad.performance.averageResponseTime < 3000) {
            reasons.push('fast response time');
        }

        const specialization = agentLoad.performance.specialization.get(task.type) || 0.5;
        if (specialization > 0.7) {
            reasons.push(`specialized in ${task.type}`);
        }

        return reasons.length > 0 ? reasons.join(', ') : 'general suitability';
    }

    private async updateAgentLoad(agentId: string, task: Task): Promise<void> {
        const agentLoad = this.agentLoads.get(agentId);
        if (!agentLoad) {
            throw new Error(`Agent ${agentId} not found`);
        }

        agentLoad.currentLoad++;
        agentLoad.queuedTasks++;
        agentLoad.utilizationRate = agentLoad.currentLoad / agentLoad.maxCapacity;
    }

    private calculateMaxCapacity(agent: Agent): number {
        // Calculate max capacity based on agent type and performance
        const baseCapacity = {
            'coordinator': 15,
            'architect': 8,
            'coder': 10,
            'tester': 12,
            'analyst': 8,
            'researcher': 6,
            'reviewer': 10,
            'optimizer': 8
        };

        const base = baseCapacity[agent.type] || 8;
        const performanceMultiplier = 0.5 + (agent.performance.successRate * 0.5);
        
        return Math.round(base * performanceMultiplier);
    }

    private calculateReliability(agent: Agent): number {
        // Calculate reliability based on success rate and consistency
        const successRate = agent.performance.successRate;
        const consistency = 1.0 - Math.abs(agent.performance.averageResponseTime - 3000) / 10000;
        
        return (successRate * 0.7) + (Math.max(0, consistency) * 0.3);
    }

    private calculateSpecialization(agent: Agent): Map<string, number> {
        const specialization = new Map<string, number>();
        
        // Initialize with base specialization based on agent type
        const typeSpecialization = {
            'coordinator': { 'analysis': 0.8, 'review': 0.9 },
            'architect': { 'analysis': 0.9, 'optimization': 0.8 },
            'coder': { 'generation': 0.9, 'refactoring': 0.8 },
            'tester': { 'testing': 0.9, 'review': 0.7 },
            'analyst': { 'analysis': 0.9, 'optimization': 0.7 },
            'researcher': { 'analysis': 0.8, 'explanation': 0.9 },
            'reviewer': { 'review': 0.9, 'analysis': 0.7 },
            'optimizer': { 'optimization': 0.9, 'refactoring': 0.8 }
        };

        const agentSpecs = typeSpecialization[agent.type] || {};
        for (const [taskType, score] of Object.entries(agentSpecs)) {
            specialization.set(taskType, score);
        }

        // Set default scores for other task types
        const allTaskTypes = ['analysis', 'generation', 'optimization', 'review', 'testing', 'refactoring', 'explanation'];
        for (const taskType of allTaskTypes) {
            if (!specialization.has(taskType)) {
                specialization.set(taskType, 0.5);
            }
        }

        return specialization;
    }

    private calculateLoadVariance(): number {
        const loads = Array.from(this.agentLoads.values()).map(agent => agent.utilizationRate);
        const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
        const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
        
        return Math.sqrt(variance);
    }

    private findOverloadedAgents(): AgentLoad[] {
        return Array.from(this.agentLoads.values()).filter(agent => 
            agent.utilizationRate > 0.8
        );
    }

    private findUnderloadedAgents(): AgentLoad[] {
        return Array.from(this.agentLoads.values()).filter(agent => 
            agent.utilizationRate < 0.5
        );
    }

    private selectBestUnderloadedAgent(underloadedAgents: AgentLoad[], requiredCapabilities: string[]): AgentLoad | null {
        if (underloadedAgents.length === 0) {return null;}

        // Find agent with best capability match and lowest load
        return underloadedAgents.reduce((best, current) => {
            const currentMatch = requiredCapabilities.filter(cap => current.capabilities.includes(cap)).length;
            const bestMatch = requiredCapabilities.filter(cap => best.capabilities.includes(cap)).length;
            
            if (currentMatch > bestMatch) {return current;}
            if (currentMatch === bestMatch && current.utilizationRate < best.utilizationRate) {return current;}
            
            return best;
        });
    }

    private updateMovingAverage(current: number, newValue: number, alpha: number): number {
        return (alpha * newValue) + ((1 - alpha) * current);
    }

    private async updateMetrics(): Promise<void> {
        const agents = Array.from(this.agentLoads.values());
        
        this.metrics.queuedTasks = agents.reduce((sum, agent) => sum + agent.queuedTasks, 0);
        this.metrics.loadVariance = this.calculateLoadVariance();
        
        // Calculate throughput (tasks per minute)
        const totalCompletedTasks = this.metrics.totalTasks - this.metrics.activeTasks;
        this.metrics.throughput = totalCompletedTasks / Math.max(1, Date.now() / 60000); // Rough estimate
        
        // Calculate efficiency
        const avgUtilization = agents.reduce((sum, agent) => sum + agent.utilizationRate, 0) / agents.length;
        this.metrics.efficiency = avgUtilization * (1.0 - this.metrics.loadVariance);
    }

    private startPeriodicRebalancing(): void {
        // Rebalance every 30 seconds
        this.rebalanceTimer = setInterval(() => {
            this.rebalanceLoad().catch(error => {
                this.outputChannel.appendLine(`❌ Periodic rebalancing failed: ${error}`);
            });
        }, 30000);
    }

    dispose(): void {
        if (this.rebalanceTimer) {
            clearInterval(this.rebalanceTimer);
        }
        this.outputChannel.dispose();
    }
}
