import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { CommandManager } from '../commands/commandManager';
export interface CommandButton {
    id: string;
    label: string;
    icon: string;
    description: string;
    command: string;
    requiresFile?: boolean;
    requiresSelection?: boolean;
    requiresSwarm?: boolean;
    category: 'core' | 'analysis' | 'generation' | 'monitoring';
    enabled: boolean;
}
export declare class EnhancedDashboard implements vscode.Disposable {
    private context;
    private swarmManager;
    private commandManager;
    private dashboardPanel?;
    private updateInterval?;
    private isStreaming;
    private outputChannel;
    private hiveOrchestrator?;
    private memoryBank?;
    private topologyManager?;
    private loadBalancer?;
    private faultTolerance?;
    private commandButtons;
    constructor(context: vscode.ExtensionContext, swarmManager: SwarmManager, commandManager: CommandManager);
    private initializeHiveMind;
    showDashboard(): Promise<void>;
    private handleWebviewMessage;
    private executeCommand;
    private spawnAgentFromDashboard;
    private terminateAgent;
    private cancelTask;
    private updateCommandStates;
    private startRealTimeUpdates;
    private stopRealTimeUpdates;
    private updateDashboard;
    private getDashboardData;
    private setupEventListeners;
    private generateDashboardHTML;
    dispose(): void;
}
//# sourceMappingURL=enhancedDashboard.d.ts.map