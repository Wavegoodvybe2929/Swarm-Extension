import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { StatusBarManager } from '../utils/statusBarManager';
export interface QueuedCommand {
    id: string;
    command: string;
    args: any[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: Date;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    result?: any;
    error?: string;
    retryCount: number;
    maxRetries: number;
    context?: {
        filePath?: string;
        workspaceFolder?: string;
        userId?: string;
    };
}
export declare class CommandQueue implements vscode.Disposable {
    private queue;
    private running;
    private maxConcurrent;
    private isProcessing;
    private eventEmitter;
    private outputChannel;
    private swarmManager;
    private statusBarManager;
    readonly onQueueEvent: vscode.Event<{
        type: string;
        command: QueuedCommand;
    }>;
    constructor(swarmManager: SwarmManager, statusBarManager: StatusBarManager);
    enqueue(command: string, args?: any[], priority?: 'low' | 'medium' | 'high' | 'critical', options?: {
        scheduledAt?: Date;
        maxRetries?: number;
        context?: QueuedCommand['context'];
    }): Promise<string>;
    cancel(commandId: string): Promise<boolean>;
    getQueueStatus(): {
        pending: number;
        running: number;
        total: number;
        commands: QueuedCommand[];
    };
    clearQueue(): Promise<void>;
    pauseProcessing(): Promise<void>;
    resumeProcessing(): Promise<void>;
    private insertByPriority;
    private startProcessing;
    private getNextCommand;
    private processCommand;
    private executeCommand;
    private updateStatusBar;
    dispose(): void;
}
//# sourceMappingURL=commandQueue.d.ts.map