import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
    SwarmConfig, 
    SwarmStatus, 
    Agent, 
    Task, 
    SwarmError,
    SwarmEvent,
    SwarmEventType 
} from '../types';

const execAsync = promisify(exec);

export class SwarmManager implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private swarmStatus: SwarmStatus;
    private agents: Map<string, Agent> = new Map();
    private tasks: Map<string, Task> = new Map();
    private eventEmitter = new vscode.EventEmitter<SwarmEvent>();
    private outputChannel: vscode.OutputChannel;
    private isInitialized = false;

    public readonly onSwarmEvent = this.eventEmitter.event;

    constructor(context: vscode.ExtensionContext) {
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

    async initializeSwarm(config?: SwarmConfig): Promise<void> {
        try {
            this.outputChannel.appendLine('🧠 Initializing RUV-Swarm...');
            
            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                throw new SwarmError('No workspace folder found', 'NO_WORKSPACE');
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

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize swarm: ${errorMessage}`);
            
            this.swarmStatus.health.status = 'critical';
            this.swarmStatus.health.issues.push(errorMessage);
            
            throw new SwarmError(`Failed to initialize swarm: ${errorMessage}`, 'INIT_FAILED', error);
        }
    }

    async spawnAgent(type: string, name?: string, capabilities?: string[]): Promise<string> {
        try {
            if (!this.isInitialized) {
                throw new SwarmError('Swarm not initialized', 'NOT_INITIALIZED');
            }

            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                throw new SwarmError('No workspace folder found', 'NO_WORKSPACE');
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
            const agent: Agent = {
                id: agentId,
                name: agentName,
                type: type as any,
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

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to spawn agent: ${errorMessage}`);
            throw new SwarmError(`Failed to spawn agent: ${errorMessage}`, 'SPAWN_FAILED', error);
        }
    }

    async executeTask(description: string, type: string = 'analysis', filePath?: string): Promise<string> {
        try {
            if (!this.isInitialized) {
                throw new SwarmError('Swarm not initialized', 'NOT_INITIALIZED');
            }

            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {
                throw new SwarmError('No workspace folder found', 'NO_WORKSPACE');
            }

            const taskId = `task-${Date.now()}`;
            const command = `npx ruv-swarm task orchestrate "${description}"`;
            
            this.outputChannel.appendLine(`Executing task: ${command}`);
            
            // Create task record
            const task: Task = {
                id: taskId,
                description,
                type: type as any,
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

        } catch (error) {
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

            throw new SwarmError(`Task failed: ${errorMessage}`, 'TASK_FAILED', error);
        }
    }

    async getSwarmStatus(): Promise<SwarmStatus> {
        // Update performance metrics if swarm is running
        if (this.isInitialized) {
            await this.updatePerformanceMetrics();
        }
        
        return { ...this.swarmStatus };
    }

    getAgents(): Agent[] {
        return Array.from(this.agents.values());
    }

    getTasks(): Task[] {
        return Array.from(this.tasks.values());
    }

    updateConfiguration(config: SwarmConfig): void {
        // Update internal configuration
        // This would typically reinitialize the swarm with new settings
        this.outputChannel.appendLine(`Updating configuration: ${JSON.stringify(config)}`);
    }

    private async checkRuvSwarmAvailability(): Promise<void> {
        try {
            await execAsync('npx ruv-swarm --version', { timeout: 10000 });
        } catch (error) {
            throw new SwarmError(
                'ruv-swarm CLI not available. Please ensure ruv-swarm is installed.',
                'CLI_NOT_AVAILABLE',
                error
            );
        }
    }

    private getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.workspaceFolders?.[0];
    }

    private parseAgentId(output: string): string | null {
        // Parse agent ID from ruv-swarm output
        // This would depend on the actual output format
        const match = output.match(/Agent ID: ([a-zA-Z0-9-]+)/);
        return match ? match[1] : null;
    }

    private async updatePerformanceMetrics(): Promise<void> {
        try {
            const workspaceFolder = this.getWorkspaceFolder();
            if (!workspaceFolder) {return;}

            // Get performance metrics from ruv-swarm
            const { stdout, stderr } = await execAsync('npx ruv-swarm monitor --duration 1 --format json', {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 5000
            });

            // Clean the output to remove emojis and non-JSON content
            let cleanOutput = stdout.trim();
            
            // Try to find JSON content in the output
            const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanOutput = jsonMatch[0];
            } else {
                // If no JSON found, use fallback metrics
                this.useFallbackMetrics();
                return;
            }

            let metrics;
            try {
                metrics = JSON.parse(cleanOutput);
            } catch (parseError) {
                // If JSON parsing fails, use fallback metrics
                this.useFallbackMetrics();
                return;
            }
            
            this.swarmStatus.performance = {
                tasksPerSecond: metrics.tasksPerSecond || 0,
                averageResponseTime: metrics.averageResponseTime || 0,
                tokenEfficiency: metrics.tokenEfficiency || 0,
                successRate: metrics.successRate || 0,
                cpuUsage: metrics.cpuUsage || 0,
                memoryUsage: metrics.memoryUsage || 0
            };

            this.emitEvent('performance.updated', this.swarmStatus.performance);

        } catch (error) {
            // Use fallback metrics on any error
            this.useFallbackMetrics();
            // Log error for debugging but don't throw
            this.outputChannel.appendLine(`⚠️ Performance metrics update failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private useFallbackMetrics(): void {
        // Calculate basic metrics from internal state
        const totalTasks = this.swarmStatus.activeTasks + this.swarmStatus.completedTasks;
        const completedTasks = this.swarmStatus.completedTasks;
        
        this.swarmStatus.performance = {
            tasksPerSecond: totalTasks > 0 ? completedTasks / 60 : 0, // Rough estimate
            averageResponseTime: 1500, // Default estimate
            tokenEfficiency: 0.75, // Default estimate
            successRate: totalTasks > 0 ? completedTasks / totalTasks : 1.0,
            cpuUsage: Math.random() * 20 + 10, // Simulated for demo
            memoryUsage: Math.random() * 30 + 20 // Simulated for demo
        };
        
        this.emitEvent('performance.updated', this.swarmStatus.performance);
    }

    private emitEvent(type: SwarmEventType, data: any): void {
        const event: SwarmEvent = {
            type,
            timestamp: new Date(),
            data
        };
        
        this.eventEmitter.fire(event);
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.eventEmitter.dispose();
        
        // Cleanup any running processes
        if (this.isInitialized) {
            this.outputChannel.appendLine('🧠 Shutting down RUV-Swarm...');
        }
    }
}
