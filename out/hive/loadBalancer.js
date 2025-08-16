"use strict";
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
exports.LoadBalancer = void 0;
const vscode = __importStar(require("vscode"));
class LoadBalancer {
    constructor(topologyManager, config) {
        this.agentLoads = new Map();
        this.taskQueue = new Map();
        this.assignmentHistory = new Map();
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
    async initializeAgents(agents) {
        try {
            this.outputChannel.appendLine(`⚖️ Initializing load balancer with ${agents.length} agents`);
            this.agentLoads.clear();
            for (const agent of agents) {
                const agentLoad = {
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
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize load balancer: ${error}`);
            throw error;
        }
    }
    async assignTask(task) {
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
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to assign task ${task.id}: ${error}`);
            throw error;
        }
    }
    async completeTask(taskId, agentId, success, duration) {
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
                agentLoad.performance.successRate = this.updateMovingAverage(agentLoad.performance.successRate, 1.0, 0.1);
            }
            else {
                agentLoad.performance.successRate = this.updateMovingAverage(agentLoad.performance.successRate, 0.0, 0.1);
            }
            agentLoad.performance.averageResponseTime = this.updateMovingAverage(agentLoad.performance.averageResponseTime, duration, 0.1);
            // Update average task duration
            agentLoad.averageTaskDuration = this.updateMovingAverage(agentLoad.averageTaskDuration, duration, 0.1);
            // Update metrics
            this.metrics.activeTasks = Math.max(0, this.metrics.activeTasks - 1);
            await this.updateMetrics();
            this.outputChannel.appendLine(`✅ Task ${taskId} completed by agent ${agentId} (success: ${success}, duration: ${duration}ms)`);
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Failed to complete task ${taskId}: ${error}`);
            throw error;
        }
    }
    async rebalanceLoad() {
        if (this.agentLoads.size === 0) {
            return;
        }
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
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Load rebalancing failed: ${error}`);
        }
    }
    async getLoadBalancingMetrics() {
        await this.updateMetrics();
        return { ...this.metrics };
    }
    getAgentLoads() {
        return Array.from(this.agentLoads.values());
    }
    getAgentLoad(agentId) {
        return this.agentLoads.get(agentId);
    }
    async predictOptimalAssignment(task) {
        // Return top 3 agent candidates with their assignment predictions
        const candidates = await this.rankAgentsForTask(task);
        return candidates.slice(0, 3);
    }
    async findOptimalAgent(task) {
        const candidates = await this.rankAgentsForTask(task);
        if (candidates.length === 0) {
            return null;
        }
        return candidates[0];
    }
    async rankAgentsForTask(task) {
        const candidates = [];
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
    async calculateAssignmentScore(task, agentLoad) {
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
    calculateCapabilityMatch(task, agentLoad) {
        // Simple capability matching based on task type and agent capabilities
        const requiredCapabilities = this.getRequiredCapabilities(task);
        const matchedCapabilities = requiredCapabilities.filter(cap => agentLoad.capabilities.includes(cap));
        return requiredCapabilities.length > 0 ?
            matchedCapabilities.length / requiredCapabilities.length : 0.5;
    }
    calculatePerformanceScore(agentLoad) {
        // Weighted combination of performance metrics
        return (agentLoad.performance.successRate * 0.4 +
            (1.0 - Math.min(agentLoad.performance.averageResponseTime / 10000, 1.0)) * 0.2 +
            agentLoad.performance.tokenEfficiency * 0.2 +
            agentLoad.performance.accuracy * 0.1 +
            agentLoad.performance.reliability * 0.1);
    }
    calculateSpecializationScore(task, agentLoad) {
        const taskType = task.type;
        const specialization = agentLoad.performance.specialization.get(taskType) || 0.5;
        return specialization;
    }
    getRequiredCapabilities(task) {
        // Map task types to required capabilities
        const capabilityMap = {
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
    getPriorityMultiplier(priority) {
        const multipliers = {
            'critical': 1.5,
            'high': 1.2,
            'medium': 1.0,
            'low': 0.8
        };
        return multipliers[priority] || 1.0;
    }
    estimateTaskDuration(task, agentLoad) {
        // Base estimation on agent's average task duration and task complexity
        const baseTime = agentLoad.averageTaskDuration || 5000; // Default 5 seconds
        const complexityMultiplier = this.getTaskComplexityMultiplier(task);
        const loadMultiplier = 1.0 + (agentLoad.utilizationRate * 0.5); // Higher load = longer duration
        return Math.round(baseTime * complexityMultiplier * loadMultiplier);
    }
    getTaskComplexityMultiplier(task) {
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
    generateAssignmentReasoning(task, agentLoad, score) {
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
    async updateAgentLoad(agentId, task) {
        const agentLoad = this.agentLoads.get(agentId);
        if (!agentLoad) {
            throw new Error(`Agent ${agentId} not found`);
        }
        agentLoad.currentLoad++;
        agentLoad.queuedTasks++;
        agentLoad.utilizationRate = agentLoad.currentLoad / agentLoad.maxCapacity;
    }
    calculateMaxCapacity(agent) {
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
    calculateReliability(agent) {
        // Calculate reliability based on success rate and consistency
        const successRate = agent.performance.successRate;
        const consistency = 1.0 - Math.abs(agent.performance.averageResponseTime - 3000) / 10000;
        return (successRate * 0.7) + (Math.max(0, consistency) * 0.3);
    }
    calculateSpecialization(agent) {
        const specialization = new Map();
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
    calculateLoadVariance() {
        const loads = Array.from(this.agentLoads.values()).map(agent => agent.utilizationRate);
        const avgLoad = loads.reduce((sum, load) => sum + load, 0) / loads.length;
        const variance = loads.reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loads.length;
        return Math.sqrt(variance);
    }
    findOverloadedAgents() {
        return Array.from(this.agentLoads.values()).filter(agent => agent.utilizationRate > 0.8);
    }
    findUnderloadedAgents() {
        return Array.from(this.agentLoads.values()).filter(agent => agent.utilizationRate < 0.5);
    }
    selectBestUnderloadedAgent(underloadedAgents, requiredCapabilities) {
        if (underloadedAgents.length === 0) {
            return null;
        }
        // Find agent with best capability match and lowest load
        return underloadedAgents.reduce((best, current) => {
            const currentMatch = requiredCapabilities.filter(cap => current.capabilities.includes(cap)).length;
            const bestMatch = requiredCapabilities.filter(cap => best.capabilities.includes(cap)).length;
            if (currentMatch > bestMatch) {
                return current;
            }
            if (currentMatch === bestMatch && current.utilizationRate < best.utilizationRate) {
                return current;
            }
            return best;
        });
    }
    updateMovingAverage(current, newValue, alpha) {
        return (alpha * newValue) + ((1 - alpha) * current);
    }
    async updateMetrics() {
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
    startPeriodicRebalancing() {
        // Rebalance every 30 seconds
        this.rebalanceTimer = setInterval(() => {
            this.rebalanceLoad().catch(error => {
                this.outputChannel.appendLine(`❌ Periodic rebalancing failed: ${error}`);
            });
        }, 30000);
    }
    dispose() {
        if (this.rebalanceTimer) {
            clearInterval(this.rebalanceTimer);
        }
        this.outputChannel.dispose();
    }
}
exports.LoadBalancer = LoadBalancer;
//# sourceMappingURL=loadBalancer.js.map