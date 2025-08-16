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
exports.HiveOrchestrator = void 0;
const vscode = __importStar(require("vscode"));
const hiveMemoryBank_1 = require("./hiveMemoryBank");
class HiveOrchestrator {
    constructor(context, config) {
        this.agents = new Map();
        this.activeAgents = new Set();
        this.dormantAgents = new Map();
        this.taskQueue = new Map();
        this.eventEmitter = new vscode.EventEmitter();
        this.isInitialized = false;
        this.onHiveEvent = this.eventEmitter.event;
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Hive Mind');
        this.config = config || {
            maxAgents: 10,
            memoryBankSize: '1GB',
            orchestrationMode: 'adaptive',
            topology: 'hierarchical',
            enableLearning: true,
            enableOptimization: true
        };
    }
    async initializeHive(config) {
        try {
            this.outputChannel.appendLine('🧠 Initializing Hive Mind...');
            if (config) {
                this.config = { ...this.config, ...config };
            }
            // Initialize memory bank
            this.memoryBank = new hiveMemoryBank_1.HiveMemoryBank(this.context.globalStorageUri.fsPath);
            await this.memoryBank.initialize();
            this.outputChannel.appendLine('💾 Memory bank initialized');
            // Spawn Queen Agent (central coordinator)
            this.queenAgent = await this.spawnQueenAgent();
            this.outputChannel.appendLine('👑 Queen Agent spawned');
            // Initialize base agent pool
            await this.initializeAgentPool();
            this.outputChannel.appendLine('🤖 Agent pool initialized');
            // Start health monitoring
            this.startHealthMonitoring();
            this.outputChannel.appendLine('❤️ Health monitoring started');
            this.isInitialized = true;
            this.emitEvent('hive.initialized', {
                config: this.config,
                agentCount: this.agents.size,
                memoryBankSize: await this.memoryBank.getSize()
            });
            this.outputChannel.appendLine('✅ Hive Mind initialized successfully!');
            vscode.window.showInformationMessage('🧠 Hive Mind is now active!');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize hive: ${errorMessage}`);
            throw new Error(`Hive initialization failed: ${errorMessage}`);
        }
    }
    async orchestrateSpecification(spec) {
        try {
            if (!this.isInitialized) {
                throw new Error('Hive not initialized');
            }
            this.outputChannel.appendLine(`🎯 Orchestrating specification: ${spec.title}`);
            // Store specification in memory bank
            await this.memoryBank.storeSpecification(spec);
            // Analyze task complexity and requirements
            const analysis = await this.analyzeSpecification(spec);
            this.outputChannel.appendLine(`📊 Specification analysis completed`);
            // Determine optimal agent assignment
            const assignment = await this.assignAgentsToTasks(spec, analysis);
            this.outputChannel.appendLine(`👥 Agent assignment completed: ${assignment.agents.length} agents assigned`);
            // Execute with coordination
            const result = await this.executeWithCoordination(spec, assignment);
            this.outputChannel.appendLine(`🎉 Specification execution completed`);
            // Store results in memory bank
            await this.memoryBank.storeExecutionResult(spec.id, result);
            this.emitEvent('specification.completed', {
                specId: spec.id,
                result,
                agentsUsed: assignment.agents.length,
                duration: result.duration
            });
            // Convert ExecutionResult to HiveOrchestrationResult
            return {
                success: result.success,
                agentsUsed: assignment.agents,
                executionTime: result.duration,
                results: result.results.map(r => ({
                    agentType: this.agents.get(r.agentId)?.type || 'unknown',
                    agentId: r.agentId,
                    success: r.success,
                    output: r.output,
                    error: r.error,
                    duration: r.duration
                })),
                errors: result.error ? [result.error] : undefined
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Specification orchestration failed: ${errorMessage}`);
            throw new Error(`Orchestration failed: ${errorMessage}`);
        }
    }
    async spawnSpecializedAgent(type, capabilities) {
        try {
            if (!this.isInitialized) {
                throw new Error('Hive not initialized');
            }
            // Check if we've reached max agents
            if (this.activeAgents.size >= this.config.maxAgents) {
                await this.optimizeAgentPool();
            }
            const agentId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const agent = {
                id: agentId,
                name: `${type.charAt(0).toUpperCase() + type.slice(1)} Agent`,
                type,
                model: this.selectOptimalModel(type),
                cognitivePattern: this.selectCognitivePattern(type),
                capabilities: capabilities || this.getDefaultCapabilities(type),
                status: 'idle',
                performance: {
                    tasksCompleted: 0,
                    successRate: 0,
                    averageResponseTime: 0,
                    tokenEfficiency: 0,
                    accuracy: 0
                },
                createdAt: new Date(),
                lastActive: new Date()
            };
            this.agents.set(agentId, agent);
            this.activeAgents.add(agentId);
            // Store agent creation in memory bank
            await this.memoryBank.storeAgentCreation(agent);
            this.emitEvent('agent.spawned', { agentId, type, capabilities });
            this.outputChannel.appendLine(`✅ ${type} agent spawned: ${agentId}`);
            return agentId;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to spawn ${type} agent: ${errorMessage}`);
            throw new Error(`Agent spawning failed: ${errorMessage}`);
        }
    }
    async getHiveStatus() {
        const activeAgentsList = Array.from(this.activeAgents).map(id => this.agents.get(id));
        const performance = await this.calculateHivePerformance();
        const health = await this.assessHiveHealth();
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isInitialized && this.activeAgents.size > 0,
            topology: this.config.topology,
            activeAgents: this.activeAgents.size,
            totalAgents: this.agents.size,
            activeTasks: this.taskQueue.size,
            completedTasks: await this.memoryBank.getCompletedTaskCount(),
            performance,
            health
        };
    }
    async queryMemoryBank(query, limit) {
        if (!this.isInitialized) {
            throw new Error('Hive not initialized');
        }
        return await this.memoryBank.query(query, limit);
    }
    getAgents() {
        return Array.from(this.agents.values());
    }
    getActiveAgents() {
        return Array.from(this.activeAgents).map(id => this.agents.get(id));
    }
    async terminateAgent(agentId) {
        try {
            if (!this.isInitialized) {
                throw new Error('Hive not initialized');
            }
            const agent = this.agents.get(agentId);
            if (!agent) {
                throw new Error(`Agent ${agentId} not found`);
            }
            // Don't allow terminating the Queen agent
            if (agentId === this.queenAgent?.id) {
                throw new Error('Cannot terminate Queen agent');
            }
            // Remove from active agents
            this.activeAgents.delete(agentId);
            // Remove from agents map
            this.agents.delete(agentId);
            // Remove from dormant agents if present
            this.dormantAgents.delete(agentId);
            this.emitEvent('agent.terminated', { agentId, type: agent.type });
            this.outputChannel.appendLine(`🔴 Agent ${agentId} terminated`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to terminate agent ${agentId}: ${errorMessage}`);
            throw new Error(`Agent termination failed: ${errorMessage}`);
        }
    }
    async clearMemoryBank() {
        try {
            if (!this.isInitialized) {
                throw new Error('Hive not initialized');
            }
            // Dispose current memory bank
            this.memoryBank.dispose();
            // Reinitialize memory bank
            this.memoryBank = new hiveMemoryBank_1.HiveMemoryBank(this.context.globalStorageUri.fsPath);
            await this.memoryBank.initialize();
            this.outputChannel.appendLine('🗑️ Memory bank cleared and reinitialized');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to clear memory bank: ${errorMessage}`);
            throw new Error(`Memory bank clear failed: ${errorMessage}`);
        }
    }
    async spawnQueenAgent() {
        const queenId = 'queen-coordinator';
        const queen = {
            id: queenId,
            name: 'Queen Coordinator',
            type: 'coordinator',
            model: 'hive-coordinator-model',
            cognitivePattern: 'systems',
            capabilities: [
                'task-coordination',
                'agent-management',
                'decision-making',
                'conflict-resolution',
                'resource-optimization'
            ],
            status: 'active',
            performance: {
                tasksCompleted: 0,
                successRate: 1.0,
                averageResponseTime: 0,
                tokenEfficiency: 1.0,
                accuracy: 1.0
            },
            createdAt: new Date(),
            lastActive: new Date()
        };
        this.agents.set(queenId, queen);
        this.activeAgents.add(queenId);
        return queen;
    }
    async initializeAgentPool() {
        // Spawn initial specialized agents based on configuration
        const initialAgents = [
            { type: 'architect', count: 1 },
            { type: 'coder', count: 2 },
            { type: 'tester', count: 1 },
            { type: 'analyst', count: 1 }
        ];
        for (const agentSpec of initialAgents) {
            for (let i = 0; i < agentSpec.count; i++) {
                await this.spawnSpecializedAgent(agentSpec.type);
            }
        }
    }
    async analyzeSpecification(spec) {
        // Analyze complexity, dependencies, and resource requirements
        const complexity = this.calculateComplexity(spec);
        const dependencies = this.analyzeDependencies(spec);
        const resourceRequirements = this.estimateResourceRequirements(spec);
        return {
            complexity,
            dependencies,
            resourceRequirements,
            estimatedDuration: spec.estimatedDuration,
            recommendedTopology: this.recommendTopology(complexity),
            requiredAgentTypes: this.identifyRequiredAgentTypes(spec)
        };
    }
    async assignAgentsToTasks(spec, analysis) {
        const assignments = [];
        for (const task of spec.tasks) {
            const suitableAgents = this.findSuitableAgents(task.assignedAgentType);
            const optimalAgent = await this.selectOptimalAgent(suitableAgents, task);
            if (optimalAgent) {
                assignments.push({
                    taskId: task.id,
                    agentId: optimalAgent.id,
                    estimatedDuration: task.estimatedDuration,
                    dependencies: task.dependencies
                });
            }
            else {
                // Spawn new agent if needed
                const newAgentId = await this.spawnSpecializedAgent(task.assignedAgentType);
                assignments.push({
                    taskId: task.id,
                    agentId: newAgentId,
                    estimatedDuration: task.estimatedDuration,
                    dependencies: task.dependencies
                });
            }
        }
        return {
            specId: spec.id,
            agents: assignments.map(a => a.agentId),
            assignments,
            coordinationStrategy: analysis.recommendedTopology === 'hierarchical' ? 'sequential' : 'parallel'
        };
    }
    async executeWithCoordination(spec, assignment) {
        const startTime = Date.now();
        const results = [];
        try {
            // Execute tasks based on coordination strategy
            if (assignment.coordinationStrategy === 'parallel') {
                results.push(...await this.executeParallel(spec, assignment));
            }
            else {
                results.push(...await this.executeSequential(spec, assignment));
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Aggregate results
            const output = this.aggregateResults(results);
            const success = results.every(r => r.success);
            return {
                success,
                output,
                duration,
                results,
                agentsUsed: assignment.agents.length,
                metrics: {
                    totalTasks: spec.tasks.length,
                    successfulTasks: results.filter(r => r.success).length,
                    averageTaskDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
                    tokenUsage: results.reduce((sum, r) => sum + (r.tokenUsage || 0), 0)
                }
            };
        }
        catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            return {
                success: false,
                output: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
                duration,
                results,
                agentsUsed: assignment.agents.length,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async executeParallel(spec, assignment) {
        const promises = assignment.assignments.map(async (taskAssignment) => {
            const task = spec.tasks.find(t => t.id === taskAssignment.taskId);
            const agent = this.agents.get(taskAssignment.agentId);
            return await this.executeTask(task, agent);
        });
        return await Promise.all(promises);
    }
    async executeSequential(spec, assignment) {
        const results = [];
        // Sort tasks by dependencies
        const sortedAssignments = this.sortTasksByDependencies(assignment.assignments, spec.tasks);
        for (const taskAssignment of sortedAssignments) {
            const task = spec.tasks.find(t => t.id === taskAssignment.taskId);
            const agent = this.agents.get(taskAssignment.agentId);
            const result = await this.executeTask(task, agent);
            results.push(result);
            // If task failed and it's critical, stop execution
            if (!result.success && task.type === 'implementation') {
                break;
            }
        }
        return results;
    }
    async executeTask(task, agent) {
        const startTime = Date.now();
        try {
            // Update agent status
            agent.status = 'busy';
            agent.lastActive = new Date();
            // Simulate task execution (this would be replaced with actual agent execution)
            const result = await this.simulateTaskExecution(task, agent);
            const endTime = Date.now();
            const duration = endTime - startTime;
            // Update agent performance
            agent.performance.tasksCompleted++;
            agent.performance.averageResponseTime =
                (agent.performance.averageResponseTime + duration) / 2;
            if (result.success) {
                agent.performance.successRate =
                    (agent.performance.successRate * (agent.performance.tasksCompleted - 1) + 1) /
                        agent.performance.tasksCompleted;
            }
            agent.status = 'idle';
            // Store task execution in memory bank
            await this.memoryBank.storeTaskExecution(task.id, agent.id, result);
            return {
                taskId: task.id,
                agentId: agent.id,
                success: result.success,
                output: result.output,
                duration,
                tokenUsage: result.tokenUsage,
                error: result.error
            };
        }
        catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            agent.status = 'error';
            return {
                taskId: task.id,
                agentId: agent.id,
                success: false,
                output: '',
                duration,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async simulateTaskExecution(task, agent) {
        // This is a simulation - in real implementation, this would interface with LM Studio
        // and execute actual agent tasks
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000)); // Simulate work
        const success = Math.random() > 0.1; // 90% success rate
        if (success) {
            return {
                success: true,
                output: `Task ${task.id} completed successfully by ${agent.type} agent. ${task.description}`,
                tokenUsage: Math.floor(Math.random() * 1000) + 500
            };
        }
        else {
            return {
                success: false,
                output: '',
                error: `Task ${task.id} failed during execution`
            };
        }
    }
    selectOptimalModel(agentType) {
        const modelMap = {
            coordinator: 'hive-coordinator-model',
            architect: 'system-design-model',
            coder: 'code-generation-model',
            tester: 'test-generation-model',
            analyst: 'analysis-model',
            researcher: 'research-model',
            reviewer: 'code-review-model',
            optimizer: 'optimization-model'
        };
        return modelMap[agentType] || 'general-purpose-model';
    }
    selectCognitivePattern(agentType) {
        const patternMap = {
            coordinator: 'systems',
            architect: 'systems',
            coder: 'convergent',
            tester: 'critical',
            analyst: 'critical',
            researcher: 'divergent',
            reviewer: 'critical',
            optimizer: 'convergent'
        };
        return patternMap[agentType] || 'hybrid';
    }
    getDefaultCapabilities(agentType) {
        const capabilityMap = {
            coordinator: ['task-coordination', 'decision-making', 'conflict-resolution'],
            architect: ['system-design', 'architecture-patterns', 'component-design'],
            coder: ['code-generation', 'bug-fixing', 'refactoring', 'implementation'],
            tester: ['test-generation', 'test-automation', 'quality-assurance'],
            analyst: ['performance-analysis', 'code-analysis', 'metrics-collection'],
            researcher: ['information-gathering', 'solution-research', 'documentation'],
            reviewer: ['code-review', 'security-analysis', 'best-practices'],
            optimizer: ['performance-optimization', 'resource-optimization', 'efficiency']
        };
        return capabilityMap[agentType] || [];
    }
    calculateComplexity(spec) {
        // Simple complexity calculation based on requirements and tasks
        const requirementComplexity = spec.requirements.length * 0.2;
        const taskComplexity = spec.tasks.length * 0.3;
        const dependencyComplexity = spec.dependencies.length * 0.1;
        return Math.min(requirementComplexity + taskComplexity + dependencyComplexity, 1.0);
    }
    analyzeDependencies(spec) {
        return spec.dependencies;
    }
    estimateResourceRequirements(spec) {
        return {
            estimatedAgents: Math.min(spec.tasks.length, this.config.maxAgents),
            estimatedMemory: spec.tasks.length * 50, // MB
            estimatedDuration: spec.estimatedDuration
        };
    }
    recommendTopology(complexity) {
        if (complexity > 0.7) {
            return 'hierarchical';
        }
        if (complexity > 0.4) {
            return 'mesh';
        }
        return 'star';
    }
    identifyRequiredAgentTypes(spec) {
        const types = new Set();
        for (const task of spec.tasks) {
            types.add(task.assignedAgentType);
        }
        return Array.from(types);
    }
    findSuitableAgents(agentType) {
        return Array.from(this.agents.values()).filter(agent => agent.type === agentType &&
            agent.status === 'idle' &&
            this.activeAgents.has(agent.id));
    }
    async selectOptimalAgent(candidates, task) {
        if (candidates.length === 0) {
            return null;
        }
        // Select based on performance metrics
        return candidates.reduce((best, current) => current.performance.successRate > best.performance.successRate ? current : best);
    }
    sortTasksByDependencies(assignments, tasks) {
        // Simple topological sort based on dependencies
        const sorted = [];
        const remaining = [...assignments];
        while (remaining.length > 0) {
            const canExecute = remaining.filter(assignment => {
                const task = tasks.find(t => t.id === assignment.taskId);
                return task.dependencies.every(dep => sorted.some(s => s.taskId === dep));
            });
            if (canExecute.length === 0) {
                // No more dependencies can be resolved, add remaining tasks
                sorted.push(...remaining);
                break;
            }
            sorted.push(...canExecute);
            canExecute.forEach(assignment => {
                const index = remaining.indexOf(assignment);
                remaining.splice(index, 1);
            });
        }
        return sorted;
    }
    aggregateResults(results) {
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        let output = `Hive Mind Execution Summary:\n`;
        output += `✅ Successful tasks: ${successful.length}\n`;
        output += `❌ Failed tasks: ${failed.length}\n\n`;
        if (successful.length > 0) {
            output += `Successful Results:\n`;
            successful.forEach(result => {
                output += `- ${result.output}\n`;
            });
        }
        if (failed.length > 0) {
            output += `\nFailed Tasks:\n`;
            failed.forEach(result => {
                output += `- Task ${result.taskId}: ${result.error}\n`;
            });
        }
        return output;
    }
    async optimizeAgentPool() {
        // Move least active agents to dormant state
        const agentsByActivity = Array.from(this.activeAgents)
            .map(id => this.agents.get(id))
            .sort((a, b) => a.lastActive.getTime() - b.lastActive.getTime());
        const agentToDormant = agentsByActivity[0];
        if (agentToDormant && agentToDormant.id !== this.queenAgent?.id) {
            await this.dormantizeAgent(agentToDormant.id);
        }
    }
    async dormantizeAgent(agentId) {
        const agent = this.agents.get(agentId);
        if (!agent) {
            return;
        }
        // Create snapshot
        const snapshot = {
            agent: { ...agent },
            timestamp: new Date(),
            memoryContext: await this.memoryBank.getAgentContext(agentId)
        };
        this.dormantAgents.set(agentId, snapshot);
        this.activeAgents.delete(agentId);
        this.outputChannel.appendLine(`💤 Agent ${agentId} moved to dormant state`);
    }
    async calculateHivePerformance() {
        const activeAgentsList = Array.from(this.activeAgents).map(id => this.agents.get(id));
        if (activeAgentsList.length === 0) {
            return {
                tasksPerSecond: 0,
                averageResponseTime: 0,
                tokenEfficiency: 0,
                successRate: 0,
                cpuUsage: 0,
                memoryUsage: 0
            };
        }
        const totalTasks = activeAgentsList.reduce((sum, agent) => sum + agent.performance.tasksCompleted, 0);
        const avgResponseTime = activeAgentsList.reduce((sum, agent) => sum + agent.performance.averageResponseTime, 0) / activeAgentsList.length;
        const avgSuccessRate = activeAgentsList.reduce((sum, agent) => sum + agent.performance.successRate, 0) / activeAgentsList.length;
        const avgTokenEfficiency = activeAgentsList.reduce((sum, agent) => sum + agent.performance.tokenEfficiency, 0) / activeAgentsList.length;
        return {
            tasksPerSecond: totalTasks / 60, // Rough estimate
            averageResponseTime: avgResponseTime,
            tokenEfficiency: avgTokenEfficiency,
            successRate: avgSuccessRate,
            cpuUsage: Math.random() * 30 + 20, // Simulated
            memoryUsage: Math.random() * 40 + 30 // Simulated
        };
    }
    async assessHiveHealth() {
        const issues = [];
        // Check agent health
        const unhealthyAgents = Array.from(this.activeAgents)
            .map(id => this.agents.get(id))
            .filter(agent => agent.status === 'error');
        if (unhealthyAgents.length > 0) {
            issues.push(`${unhealthyAgents.length} agents in error state`);
        }
        // Check memory bank health
        const memoryHealth = await this.memoryBank.checkHealth();
        if (!memoryHealth.healthy) {
            issues.push(`Memory bank issues: ${memoryHealth.issues.join(', ')}`);
        }
        // Determine overall status
        let status;
        if (!this.isInitialized) {
            status = 'offline';
        }
        else if (issues.length === 0) {
            status = 'healthy';
        }
        else if (issues.length <= 2) {
            status = 'degraded';
        }
        else {
            status = 'critical';
        }
        return {
            status,
            issues,
            lastHealthCheck: new Date()
        };
    }
    startHealthMonitoring() {
        // Check health every 30 seconds
        setInterval(async () => {
            const health = await this.assessHiveHealth();
            if (health.status !== 'healthy') {
                this.outputChannel.appendLine(`⚠️ Hive health: ${health.status} - Issues: ${health.issues.join(', ')}`);
            }
        }, 30000);
    }
    emitEvent(type, data) {
        const event = {
            type,
            timestamp: new Date(),
            data
        };
        this.eventEmitter.fire(event);
    }
    dispose() {
        this.outputChannel.dispose();
        this.eventEmitter.dispose();
        if (this.memoryBank) {
            this.memoryBank.dispose();
        }
        this.outputChannel.appendLine('🧠 Hive Mind shutting down...');
    }
}
exports.HiveOrchestrator = HiveOrchestrator;
//# sourceMappingURL=hiveOrchestrator.js.map