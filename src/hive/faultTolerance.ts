import * as vscode from 'vscode';
import { Agent, Task, SwarmHealth } from '../types';
import { TopologyManager } from './topologyManager';
import { LoadBalancer } from './loadBalancer';

export interface FaultToleranceConfig {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    healthCheckInterval: number;
    autoRecovery: boolean;
    circuitBreakerThreshold: number;
    redundancyLevel: number;
    backupAgentRatio: number;
}

export interface HealthCheck {
    agentId: string;
    timestamp: Date;
    status: 'healthy' | 'degraded' | 'critical' | 'offline';
    responseTime: number;
    errorRate: number;
    lastError?: string;
    consecutiveFailures: number;
}

export interface RecoveryAction {
    type: 'restart_agent' | 'reassign_tasks' | 'spawn_backup' | 'isolate_agent' | 'topology_switch';
    agentId?: string;
    reason: string;
    timestamp: Date;
    success?: boolean;
    details?: any;
}

export interface CircuitBreaker {
    agentId: string;
    state: 'closed' | 'open' | 'half_open';
    failureCount: number;
    lastFailureTime: Date;
    nextRetryTime: Date;
    threshold: number;
}

export class FaultToleranceManager implements vscode.Disposable {
    private config: FaultToleranceConfig;
    private topologyManager: TopologyManager;
    private loadBalancer: LoadBalancer;
    private healthChecks: Map<string, HealthCheck> = new Map();
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private recoveryActions: RecoveryAction[] = [];
    private backupAgents: Map<string, Agent> = new Map();
    private outputChannel: vscode.OutputChannel;
    private healthCheckTimer?: NodeJS.Timeout;
    private isRecovering = false;

    constructor(
        topologyManager: TopologyManager,
        loadBalancer: LoadBalancer,
        config?: Partial<FaultToleranceConfig>
    ) {
        this.topologyManager = topologyManager;
        this.loadBalancer = loadBalancer;
        this.config = {
            enabled: true,
            maxRetries: 3,
            retryDelay: 5000,
            healthCheckInterval: 30000,
            autoRecovery: true,
            circuitBreakerThreshold: 5,
            redundancyLevel: 2,
            backupAgentRatio: 0.2,
            ...config
        };

        this.outputChannel = vscode.window.createOutputChannel('Fault Tolerance');
        
        if (this.config.enabled) {
            this.startHealthMonitoring();
        }
    }

    async initializeAgents(agents: Agent[]): Promise<void> {
        try {
            this.outputChannel.appendLine(`🛡️ Initializing fault tolerance for ${agents.length} agents`);

            // Initialize health checks for all agents
            for (const agent of agents) {
                this.healthChecks.set(agent.id, {
                    agentId: agent.id,
                    timestamp: new Date(),
                    status: 'healthy',
                    responseTime: 0,
                    errorRate: 0,
                    consecutiveFailures: 0
                });

                // Initialize circuit breaker
                this.circuitBreakers.set(agent.id, {
                    agentId: agent.id,
                    state: 'closed',
                    failureCount: 0,
                    lastFailureTime: new Date(0),
                    nextRetryTime: new Date(0),
                    threshold: this.config.circuitBreakerThreshold
                });
            }

            // Create backup agents if needed
            await this.createBackupAgents(agents);

            this.outputChannel.appendLine(`✅ Fault tolerance initialized successfully`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to initialize fault tolerance: ${error}`);
            throw error;
        }
    }

    async handleAgentFailure(agentId: string, error: string, task?: Task): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`🚨 Agent failure detected: ${agentId} - ${error}`);

            // Update health check
            const healthCheck = this.healthChecks.get(agentId);
            if (healthCheck) {
                healthCheck.consecutiveFailures++;
                healthCheck.lastError = error;
                healthCheck.status = this.determineHealthStatus(healthCheck);
                healthCheck.timestamp = new Date();
            }

            // Update circuit breaker
            const circuitBreaker = this.circuitBreakers.get(agentId);
            if (circuitBreaker) {
                circuitBreaker.failureCount++;
                circuitBreaker.lastFailureTime = new Date();
                
                if (circuitBreaker.failureCount >= circuitBreaker.threshold) {
                    circuitBreaker.state = 'open';
                    circuitBreaker.nextRetryTime = new Date(Date.now() + this.config.retryDelay * 2);
                    this.outputChannel.appendLine(`🔴 Circuit breaker opened for agent ${agentId}`);
                }
            }

            // Attempt recovery if auto-recovery is enabled
            if (this.config.autoRecovery) {
                return await this.attemptRecovery(agentId, error, task);
            }

            return false;

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to handle agent failure: ${error}`);
            return false;
        }
    }

    async handleTaskFailure(task: Task, agentId: string, error: string): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`📋 Task failure: ${task.id} on agent ${agentId} - ${error}`);

            // Check if this is a systemic failure or isolated incident
            const recentFailures = this.getRecentFailures(agentId, 5 * 60 * 1000); // Last 5 minutes
            
            if (recentFailures.length >= 3) {
                // Systemic failure - handle agent failure
                return await this.handleAgentFailure(agentId, `Multiple task failures: ${error}`, task);
            }

            // Isolated failure - try to reassign task
            return await this.reassignTask(task, agentId, error);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to handle task failure: ${error}`);
            return false;
        }
    }

    async performHealthCheck(agentId: string): Promise<HealthCheck> {
        const startTime = Date.now();
        
        try {
            // Simulate health check (in real implementation, this would ping the agent)
            const responseTime = await this.pingAgent(agentId);
            const errorRate = this.calculateErrorRate(agentId);
            
            const healthCheck: HealthCheck = {
                agentId,
                timestamp: new Date(),
                status: this.determineHealthStatusFromMetrics(responseTime, errorRate),
                responseTime,
                errorRate,
                consecutiveFailures: 0
            };

            this.healthChecks.set(agentId, healthCheck);
            return healthCheck;

        } catch (error) {
            const healthCheck = this.healthChecks.get(agentId) || {
                agentId,
                timestamp: new Date(),
                status: 'offline',
                responseTime: Date.now() - startTime,
                errorRate: 1.0,
                consecutiveFailures: 0
            };

            healthCheck.consecutiveFailures++;
            healthCheck.lastError = error instanceof Error ? error.message : String(error);
            healthCheck.status = this.determineHealthStatus(healthCheck);
            healthCheck.timestamp = new Date();

            this.healthChecks.set(agentId, healthCheck);
            return healthCheck;
        }
    }

    async getSystemHealth(): Promise<SwarmHealth> {
        const healthChecks = Array.from(this.healthChecks.values());
        const issues: string[] = [];

        // Analyze overall system health
        const offlineAgents = healthChecks.filter(hc => hc.status === 'offline').length;
        const criticalAgents = healthChecks.filter(hc => hc.status === 'critical').length;
        const degradedAgents = healthChecks.filter(hc => hc.status === 'degraded').length;

        if (offlineAgents > 0) {
            issues.push(`${offlineAgents} agents offline`);
        }
        if (criticalAgents > 0) {
            issues.push(`${criticalAgents} agents in critical state`);
        }
        if (degradedAgents > 0) {
            issues.push(`${degradedAgents} agents degraded`);
        }

        // Check circuit breakers
        const openCircuits = Array.from(this.circuitBreakers.values()).filter(cb => cb.state === 'open').length;
        if (openCircuits > 0) {
            issues.push(`${openCircuits} circuit breakers open`);
        }

        // Determine overall status
        let status: 'healthy' | 'degraded' | 'critical' | 'offline';
        const totalAgents = healthChecks.length;
        const healthyAgents = totalAgents - offlineAgents - criticalAgents - degradedAgents;

        if (totalAgents === 0 || healthyAgents === 0) {
            status = 'offline';
        } else if (healthyAgents / totalAgents < 0.5) {
            status = 'critical';
        } else if (healthyAgents / totalAgents < 0.8) {
            status = 'degraded';
        } else {
            status = 'healthy';
        }

        return {
            status,
            issues,
            lastHealthCheck: new Date()
        };
    }

    async recoverAgent(agentId: string): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`🔄 Attempting to recover agent ${agentId}`);

            const circuitBreaker = this.circuitBreakers.get(agentId);
            if (circuitBreaker && circuitBreaker.state === 'open') {
                if (Date.now() < circuitBreaker.nextRetryTime.getTime()) {
                    this.outputChannel.appendLine(`⏳ Circuit breaker still open for agent ${agentId}, waiting...`);
                    return false;
                }
                
                // Try half-open state
                circuitBreaker.state = 'half_open';
                this.outputChannel.appendLine(`🟡 Circuit breaker half-open for agent ${agentId}`);
            }

            // Perform health check
            const healthCheck = await this.performHealthCheck(agentId);
            
            if (healthCheck.status === 'healthy') {
                // Recovery successful
                if (circuitBreaker) {
                    circuitBreaker.state = 'closed';
                    circuitBreaker.failureCount = 0;
                }
                
                this.recordRecoveryAction({
                    type: 'restart_agent',
                    agentId,
                    reason: 'Health check passed',
                    timestamp: new Date(),
                    success: true
                });

                this.outputChannel.appendLine(`✅ Agent ${agentId} recovered successfully`);
                return true;
            } else {
                // Recovery failed
                if (circuitBreaker) {
                    circuitBreaker.state = 'open';
                    circuitBreaker.nextRetryTime = new Date(Date.now() + this.config.retryDelay * 2);
                }

                this.recordRecoveryAction({
                    type: 'restart_agent',
                    agentId,
                    reason: 'Health check failed',
                    timestamp: new Date(),
                    success: false
                });

                this.outputChannel.appendLine(`❌ Agent ${agentId} recovery failed`);
                return false;
            }

        } catch (error) {
            this.outputChannel.appendLine(`❌ Agent recovery failed: ${error}`);
            return false;
        }
    }

    async isolateAgent(agentId: string, reason: string): Promise<void> {
        try {
            this.outputChannel.appendLine(`🔒 Isolating agent ${agentId}: ${reason}`);

            // Remove agent from topology
            await this.topologyManager.removeAgent(agentId);

            // Mark circuit breaker as permanently open
            const circuitBreaker = this.circuitBreakers.get(agentId);
            if (circuitBreaker) {
                circuitBreaker.state = 'open';
                circuitBreaker.nextRetryTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            }

            // Update health status
            const healthCheck = this.healthChecks.get(agentId);
            if (healthCheck) {
                healthCheck.status = 'offline';
                healthCheck.lastError = `Isolated: ${reason}`;
            }

            this.recordRecoveryAction({
                type: 'isolate_agent',
                agentId,
                reason,
                timestamp: new Date(),
                success: true
            });

            this.outputChannel.appendLine(`✅ Agent ${agentId} isolated successfully`);

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to isolate agent ${agentId}: ${error}`);
            throw error;
        }
    }

    getRecoveryHistory(): RecoveryAction[] {
        return [...this.recoveryActions].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    getHealthChecks(): HealthCheck[] {
        return Array.from(this.healthChecks.values());
    }

    getCircuitBreakerStatus(): CircuitBreaker[] {
        return Array.from(this.circuitBreakers.values());
    }

    private async attemptRecovery(agentId: string, error: string, task?: Task): Promise<boolean> {
        if (this.isRecovering) {
            this.outputChannel.appendLine(`⏳ Recovery already in progress, skipping...`);
            return false;
        }

        try {
            this.isRecovering = true;
            this.outputChannel.appendLine(`🔄 Starting recovery process for agent ${agentId}`);

            // Step 1: Try to recover the agent
            const agentRecovered = await this.recoverAgent(agentId);
            
            if (agentRecovered) {
                // If task was provided and agent recovered, retry the task
                if (task) {
                    return await this.retryTask(task, agentId);
                }
                return true;
            }

            // Step 2: If agent recovery failed, try to reassign tasks
            if (task) {
                const taskReassigned = await this.reassignTask(task, agentId, error);
                if (taskReassigned) {
                    return true;
                }
            }

            // Step 3: If task reassignment failed, try to spawn backup agent
            const backupSpawned = await this.spawnBackupAgent(agentId);
            if (backupSpawned && task) {
                return await this.reassignTask(task, agentId, error);
            }

            // Step 4: If all else fails, isolate the agent
            await this.isolateAgent(agentId, `Recovery failed: ${error}`);
            
            return false;

        } catch (error) {
            this.outputChannel.appendLine(`❌ Recovery process failed: ${error}`);
            return false;
        } finally {
            this.isRecovering = false;
        }
    }

    private async reassignTask(task: Task, failedAgentId: string, error: string): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`🔄 Reassigning task ${task.id} from failed agent ${failedAgentId}`);

            // Find alternative agent
            const assignment = await this.loadBalancer.assignTask(task);
            
            if (assignment && assignment.agentId !== failedAgentId) {
                this.recordRecoveryAction({
                    type: 'reassign_tasks',
                    agentId: failedAgentId,
                    reason: `Task reassigned to ${assignment.agentId}`,
                    timestamp: new Date(),
                    success: true,
                    details: { taskId: task.id, newAgentId: assignment.agentId }
                });

                this.outputChannel.appendLine(`✅ Task ${task.id} reassigned to agent ${assignment.agentId}`);
                return true;
            }

            return false;

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to reassign task: ${error}`);
            return false;
        }
    }

    private async retryTask(task: Task, agentId: string): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`🔄 Retrying task ${task.id} on recovered agent ${agentId}`);

            // Simulate task retry (in real implementation, this would resubmit the task)
            const success = Math.random() > 0.3; // 70% success rate for retries

            if (success) {
                this.outputChannel.appendLine(`✅ Task ${task.id} retry successful on agent ${agentId}`);
                return true;
            } else {
                this.outputChannel.appendLine(`❌ Task ${task.id} retry failed on agent ${agentId}`);
                return false;
            }

        } catch (error) {
            this.outputChannel.appendLine(`❌ Task retry failed: ${error}`);
            return false;
        }
    }

    private async spawnBackupAgent(failedAgentId: string): Promise<boolean> {
        try {
            const backupAgent = this.backupAgents.get(failedAgentId);
            if (!backupAgent) {
                this.outputChannel.appendLine(`❌ No backup agent available for ${failedAgentId}`);
                return false;
            }

            this.outputChannel.appendLine(`🆘 Spawning backup agent for ${failedAgentId}`);

            // Add backup agent to topology
            await this.topologyManager.addAgent(backupAgent);

            // Initialize health monitoring for backup agent
            await this.initializeAgents([backupAgent]);

            this.recordRecoveryAction({
                type: 'spawn_backup',
                agentId: failedAgentId,
                reason: `Backup agent ${backupAgent.id} spawned`,
                timestamp: new Date(),
                success: true,
                details: { backupAgentId: backupAgent.id }
            });

            this.outputChannel.appendLine(`✅ Backup agent ${backupAgent.id} spawned successfully`);
            return true;

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to spawn backup agent: ${error}`);
            return false;
        }
    }

    private async createBackupAgents(agents: Agent[]): Promise<void> {
        const backupCount = Math.ceil(agents.length * this.config.backupAgentRatio);
        
        this.outputChannel.appendLine(`🆘 Creating ${backupCount} backup agents`);

        for (let i = 0; i < backupCount; i++) {
            const sourceAgent = agents[i % agents.length];
            const backupAgent: Agent = {
                ...sourceAgent,
                id: `backup-${sourceAgent.id}-${Date.now()}`,
                name: `Backup ${sourceAgent.name}`,
                status: 'offline'
            };

            this.backupAgents.set(sourceAgent.id, backupAgent);
        }
    }

    private async pingAgent(agentId: string): Promise<number> {
        const startTime = Date.now();
        
        // Simulate agent ping (in real implementation, this would be an actual health check)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
        
        // Simulate occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
            throw new Error('Agent ping timeout');
        }
        
        return Date.now() - startTime;
    }

    private calculateErrorRate(agentId: string): number {
        // Get recent assignment history for this agent
        const recentActions = this.recoveryActions
            .filter(action => action.agentId === agentId)
            .filter(action => Date.now() - action.timestamp.getTime() < 5 * 60 * 1000); // Last 5 minutes

        if (recentActions.length === 0) {return 0;}

        const failures = recentActions.filter(action => !action.success).length;
        return failures / recentActions.length;
    }

    private determineHealthStatus(healthCheck: HealthCheck): 'healthy' | 'degraded' | 'critical' | 'offline' {
        if (healthCheck.consecutiveFailures >= 5) {
            return 'offline';
        } else if (healthCheck.consecutiveFailures >= 3 || healthCheck.errorRate > 0.5) {
            return 'critical';
        } else if (healthCheck.consecutiveFailures >= 1 || healthCheck.errorRate > 0.2 || healthCheck.responseTime > 5000) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    private determineHealthStatusFromMetrics(responseTime: number, errorRate: number): 'healthy' | 'degraded' | 'critical' | 'offline' {
        if (errorRate > 0.5 || responseTime > 10000) {
            return 'critical';
        } else if (errorRate > 0.2 || responseTime > 5000) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    private getRecentFailures(agentId: string, timeWindow: number): RecoveryAction[] {
        const cutoff = Date.now() - timeWindow;
        return this.recoveryActions.filter(action => 
            action.agentId === agentId && 
            action.timestamp.getTime() > cutoff &&
            !action.success
        );
    }

    private recordRecoveryAction(action: RecoveryAction): void {
        this.recoveryActions.push(action);
        
        // Keep only last 1000 actions
        if (this.recoveryActions.length > 1000) {
            this.recoveryActions = this.recoveryActions.slice(-1000);
        }
    }

    private startHealthMonitoring(): void {
        this.outputChannel.appendLine(`❤️ Starting health monitoring (interval: ${this.config.healthCheckInterval}ms)`);
        
        this.healthCheckTimer = setInterval(async () => {
            try {
                const agentIds = Array.from(this.healthChecks.keys());
                
                for (const agentId of agentIds) {
                    const circuitBreaker = this.circuitBreakers.get(agentId);
                    
                    // Skip agents with open circuit breakers
                    if (circuitBreaker && circuitBreaker.state === 'open' && 
                        Date.now() < circuitBreaker.nextRetryTime.getTime()) {
                        continue;
                    }
                    
                    await this.performHealthCheck(agentId);
                }
                
            } catch (error) {
                this.outputChannel.appendLine(`❌ Health monitoring error: ${error}`);
            }
        }, this.config.healthCheckInterval);
    }

    dispose(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }
        this.outputChannel.dispose();
    }
}
