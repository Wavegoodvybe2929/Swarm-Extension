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
export declare class FaultToleranceManager implements vscode.Disposable {
    private config;
    private topologyManager;
    private loadBalancer;
    private healthChecks;
    private circuitBreakers;
    private recoveryActions;
    private backupAgents;
    private outputChannel;
    private healthCheckTimer?;
    private isRecovering;
    constructor(topologyManager: TopologyManager, loadBalancer: LoadBalancer, config?: Partial<FaultToleranceConfig>);
    initializeAgents(agents: Agent[]): Promise<void>;
    handleAgentFailure(agentId: string, error: string, task?: Task): Promise<boolean>;
    handleTaskFailure(task: Task, agentId: string, error: string): Promise<boolean>;
    performHealthCheck(agentId: string): Promise<HealthCheck>;
    getSystemHealth(): Promise<SwarmHealth>;
    recoverAgent(agentId: string): Promise<boolean>;
    isolateAgent(agentId: string, reason: string): Promise<void>;
    getRecoveryHistory(): RecoveryAction[];
    getHealthChecks(): HealthCheck[];
    getCircuitBreakerStatus(): CircuitBreaker[];
    private attemptRecovery;
    private reassignTask;
    private retryTask;
    private spawnBackupAgent;
    private createBackupAgents;
    private pingAgent;
    private calculateErrorRate;
    private determineHealthStatus;
    private determineHealthStatusFromMetrics;
    private getRecentFailures;
    private recordRecoveryAction;
    private startHealthMonitoring;
    dispose(): void;
}
//# sourceMappingURL=faultTolerance.d.ts.map