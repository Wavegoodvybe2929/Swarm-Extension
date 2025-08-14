import * as vscode from 'vscode';
import { SwarmConfig, SwarmStatus, Agent, Task, SwarmEvent } from '../types';
export declare class SwarmManager implements vscode.Disposable {
    private context;
    private swarmStatus;
    private agents;
    private tasks;
    private eventEmitter;
    private outputChannel;
    private isInitialized;
    readonly onSwarmEvent: vscode.Event<SwarmEvent>;
    constructor(context: vscode.ExtensionContext);
    initializeSwarm(config?: SwarmConfig): Promise<void>;
    spawnAgent(type: string, name?: string, capabilities?: string[]): Promise<string>;
    executeTask(description: string, type?: string, filePath?: string): Promise<string>;
    getSwarmStatus(): Promise<SwarmStatus>;
    getAgents(): Agent[];
    getTasks(): Task[];
    updateConfiguration(config: SwarmConfig): void;
    private checkRuvSwarmAvailability;
    private getWorkspaceFolder;
    private parseAgentId;
    private updatePerformanceMetrics;
    private emitEvent;
    dispose(): void;
}
//# sourceMappingURL=swarmManager.d.ts.map