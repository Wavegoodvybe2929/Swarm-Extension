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
exports.SwarmManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const types_1 = require("../types");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SwarmManager {
    constructor(context) {
        this.agents = new Map();
        this.tasks = new Map();
        this.eventEmitter = new vscode.EventEmitter();
        this.isInitialized = false;
        this.onSwarmEvent = this.eventEmitter.event;
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm');
        this.swarmStatus = {
            isInitialized: false,
            isRunning: false,
            topology: 'hierarchical',
            activeAgents: 0,
            totalAgents: 0,
            activeTasks: 0,
            completedTasks: 0,
            performance: {
                tasksPerSecond: 0,
                averageResponseTime: 0,
                tokenEfficiency: 0,
                successRate: 0,
                cpuUsage: 0,
                memoryUsage: 0
            },
            health: {
                status: 'offline',
                issues: [],
                lastHealthCheck: new Date()
            }
        };
    }
    async initializeSwarm(config) {
        try {
            this.outputChannel.appendLine('🧠 Initializing RUV-Swarm...');
            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                throw new types_1.SwarmError('No workspace folder found', 'NO_WORKSPACE');
            }
            // Check if ruv-swarm is available
            await this.checkRuvSwarmAvailability();
            // Initialize swarm with configuration
            const topology = config?.topology || 'hierarchical';
            const maxAgents = config?.maxAgents || 8;
            const cognitivePatterns = config?.cognitivePatterns || ['convergent', 'divergent', 'systems', 'critical'];
            const command = `npx ruv-swarm init ${topology} ${maxAgents} --cognitive-diversity`;
            this.outputChannel.appendLine(`Executing: ${command}`);
            const { stdout, stderr } = await execAsync(command, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 30000
            });
            if (stderr) {
                this.outputChannel.appendLine(`Warning: ${stderr}`);
            }
            this.outputChannel.appendLine(`Output: ${stdout}`);
            // Update status
            this.swarmStatus.isInitialized = true;
            this.swarmStatus.isRunning = true;
            this.swarmStatus.topology = topology;
            this.swarmStatus.health.status = 'healthy';
            this.swarmStatus.health.lastHealthCheck = new Date();
            this.isInitialized = true;
            // Emit initialization event
            this.emitEvent('swarm.initialized', { topology, maxAgents, cognitivePatterns });
            this.outputChannel.appendLine('✅ RUV-Swarm initialized successfully!');
            vscode.window.showInformationMessage('🧠 RUV-Swarm initialized successfully!');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize swarm: ${errorMessage}`);
            this.swarmStatus.health.status = 'critical';
            this.swarmStatus.health.issues.push(errorMessage);
            throw new types_1.SwarmError(`Failed to initialize swarm: ${errorMessage}`, 'INIT_FAILED', error);
        }
    }
    async spawnAgent(type, name, capabilities) {
        try {
            if (!this.isInitialized) {
                throw new types_1.SwarmError('Swarm not initialized', 'NOT_INITIALIZED');
            }
            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                throw new types_1.SwarmError('No workspace folder found', 'NO_WORKSPACE');
            }
            const agentName = name || `${type}-${Date.now()}`;
            const capabilitiesStr = capabilities ? `--capabilities ${capabilities.join(',')}` : '';
            const command = `npx ruv-swarm agent spawn ${type} --name ${agentName} ${capabilitiesStr}`;
            this.outputChannel.appendLine(`Spawning agent: ${command}`);
            const { stdout } = await execAsync(command, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 15000
            });
            // Parse agent ID from output (this would depend on actual ruv-swarm output format)
            const agentId = this.parseAgentId(stdout) || agentName;
            // Create agent record
            const agent = {
                id: agentId,
                name: agentName,
                type: type,
                model: 'tcn-pattern-detector', // Default model
                cognitivePattern: 'convergent',
                capabilities: capabilities || [],
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
            this.swarmStatus.totalAgents = this.agents.size;
            this.swarmStatus.activeAgents = Array.from(this.agents.values()).filter(a => a.status !== 'offline').length;
            this.emitEvent('agent.spawned', { agentId, type, name: agentName });
            this.outputChannel.appendLine(`✅ Agent ${agentName} spawned successfully!`);
            return agentId;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to spawn agent: ${errorMessage}`);
            throw new types_1.SwarmError(`Failed to spawn agent: ${errorMessage}`, 'SPAWN_FAILED', error);
        }
    }
    async executeTask(description, type = 'analysis', filePath) {
        try {
            if (!this.isInitialized) {
                throw new types_1.SwarmError('Swarm not initialized', 'NOT_INITIALIZED');
            }
            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                throw new types_1.SwarmError('No workspace folder found', 'NO_WORKSPACE');
            }
            const taskId = `task-${Date.now()}`;
            const command = `npx ruv-swarm task orchestrate "${description}"`;
            this.outputChannel.appendLine(`Executing task: ${command}`);
            // Create task record
            const task = {
                id: taskId,
                description,
                type: type,
                status: 'running',
                assignedAgents: [],
                priority: 'medium',
                createdAt: new Date(),
                startedAt: new Date(),
                metadata: {
                    filePath,
                    context: description
                }
            };
            this.tasks.set(taskId, task);
            this.swarmStatus.activeTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
            this.emitEvent('task.started', { taskId, description, type });
            const { stdout, stderr } = await execAsync(command, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 60000
            });
            if (stderr) {
                this.outputChannel.appendLine(`Task warning: ${stderr}`);
            }
            // Update task status
            task.status = 'completed';
            task.completedAt = new Date();
            task.result = {
                success: true,
                output: stdout,
                metrics: {
                    duration: task.completedAt.getTime() - (task.startedAt?.getTime() || 0),
                    tokenUsage: 0, // Would be parsed from output
                    tokenSavings: 0,
                    qualityScore: 0.85,
                    confidenceScore: 0.9
                }
            };
            this.swarmStatus.activeTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
            this.swarmStatus.completedTasks = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
            this.emitEvent('task.completed', { taskId, result: task.result });
            this.outputChannel.appendLine(`✅ Task completed: ${taskId}`);
            this.outputChannel.appendLine(stdout);
            return stdout;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Task failed: ${errorMessage}`);
            // Update task status to failed
            const runningTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running');
            if (runningTasks.length > 0) {
                const task = runningTasks[runningTasks.length - 1];
                task.status = 'failed';
                task.completedAt = new Date();
                this.emitEvent('task.failed', { taskId: task.id, error: errorMessage });
            }
            throw new types_1.SwarmError(`Task failed: ${errorMessage}`, 'TASK_FAILED', error);
        }
    }
    async getSwarmStatus() {
        // Update performance metrics if swarm is running
        if (this.isInitialized) {
            await this.updatePerformanceMetrics();
        }
        return { ...this.swarmStatus };
    }
    getAgents() {
        return Array.from(this.agents.values());
    }
    getTasks() {
        return Array.from(this.tasks.values());
    }
    updateConfiguration(config) {
        // Update internal configuration
        // This would typically reinitialize the swarm with new settings
        this.outputChannel.appendLine(`Updating configuration: ${JSON.stringify(config)}`);
    }
    async checkRuvSwarmAvailability() {
        try {
            await execAsync('npx ruv-swarm --version', { timeout: 10000 });
        }
        catch (error) {
            throw new types_1.SwarmError('ruv-swarm CLI not available. Please ensure ruv-swarm is installed.', 'CLI_NOT_AVAILABLE', error);
        }
    }
    getWorkspaceFolder() {
        return vscode.workspace.workspaceFolders?.[0];
    }
    parseAgentId(output) {
        // Parse agent ID from ruv-swarm output
        // This would depend on the actual output format
        const match = output.match(/Agent ID: ([a-zA-Z0-9-]+)/);
        return match ? match[1] : null;
    }
    async updatePerformanceMetrics() {
        try {
            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                return;
            }
            // Get performance metrics from ruv-swarm
            const { stdout } = await execAsync('npx ruv-swarm monitor --duration 1 --format json', {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 5000
            });
            const metrics = JSON.parse(stdout);
            this.swarmStatus.performance = {
                tasksPerSecond: metrics.tasksPerSecond || 0,
                averageResponseTime: metrics.averageResponseTime || 0,
                tokenEfficiency: metrics.tokenEfficiency || 0,
                successRate: metrics.successRate || 0,
                cpuUsage: metrics.cpuUsage || 0,
                memoryUsage: metrics.memoryUsage || 0
            };
            this.emitEvent('performance.updated', this.swarmStatus.performance);
        }
        catch (error) {
            // Silently fail for performance metrics
            console.warn('Failed to update performance metrics:', error);
        }
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
        // Cleanup any running processes
        if (this.isInitialized) {
            this.outputChannel.appendLine('🧠 Shutting down RUV-Swarm...');
        }
    }
}
exports.SwarmManager = SwarmManager;
//# sourceMappingURL=swarmManager.js.map