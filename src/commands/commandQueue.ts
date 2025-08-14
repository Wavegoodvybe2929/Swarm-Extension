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

export class CommandQueue implements vscode.Disposable {
    private queue: QueuedCommand[] = [];
    private running: Map<string, QueuedCommand> = new Map();
    private maxConcurrent = 3;
    private isProcessing = false;
    private eventEmitter = new vscode.EventEmitter<{ type: string; command: QueuedCommand }>();
    private outputChannel: vscode.OutputChannel;
    private swarmManager: SwarmManager;
    private statusBarManager: StatusBarManager;

    public readonly onQueueEvent = this.eventEmitter.event;

    constructor(swarmManager: SwarmManager, statusBarManager: StatusBarManager) {
        this.swarmManager = swarmManager;
        this.statusBarManager = statusBarManager;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Command Queue');
        
        // Start processing queue
        this.startProcessing();
    }

    async enqueue(
        command: string, 
        args: any[] = [], 
        priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
        options?: {
            scheduledAt?: Date;
            maxRetries?: number;
            context?: QueuedCommand['context'];
        }
    ): Promise<string> {
        const queuedCommand: QueuedCommand = {
            id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            command,
            args,
            priority,
            createdAt: new Date(),
            scheduledAt: options?.scheduledAt,
            status: 'pending',
            retryCount: 0,
            maxRetries: options?.maxRetries || 3,
            context: options?.context
        };

        // Insert based on priority
        this.insertByPriority(queuedCommand);
        
        this.outputChannel.appendLine(`📋 Queued command: ${command} (ID: ${queuedCommand.id}, Priority: ${priority})`);
        this.eventEmitter.fire({ type: 'queued', command: queuedCommand });
        
        // Update status bar
        this.updateStatusBar();
        
        return queuedCommand.id;
    }

    async cancel(commandId: string): Promise<boolean> {
        // Check if command is in queue
        const queueIndex = this.queue.findIndex(cmd => cmd.id === commandId);
        if (queueIndex !== -1) {
            const command = this.queue[queueIndex];
            command.status = 'cancelled';
            this.queue.splice(queueIndex, 1);
            
            this.outputChannel.appendLine(`❌ Cancelled queued command: ${command.command} (ID: ${commandId})`);
            this.eventEmitter.fire({ type: 'cancelled', command });
            this.updateStatusBar();
            return true;
        }

        // Check if command is running
        const runningCommand = this.running.get(commandId);
        if (runningCommand) {
            runningCommand.status = 'cancelled';
            this.running.delete(commandId);
            
            this.outputChannel.appendLine(`❌ Cancelled running command: ${runningCommand.command} (ID: ${commandId})`);
            this.eventEmitter.fire({ type: 'cancelled', command: runningCommand });
            this.updateStatusBar();
            return true;
        }

        return false;
    }

    getQueueStatus(): {
        pending: number;
        running: number;
        total: number;
        commands: QueuedCommand[];
    } {
        return {
            pending: this.queue.length,
            running: this.running.size,
            total: this.queue.length + this.running.size,
            commands: [...this.queue, ...Array.from(this.running.values())]
        };
    }

    async clearQueue(): Promise<void> {
        const cancelledCount = this.queue.length;
        this.queue.forEach(cmd => {
            cmd.status = 'cancelled';
            this.eventEmitter.fire({ type: 'cancelled', command: cmd });
        });
        
        this.queue = [];
        this.outputChannel.appendLine(`🗑️ Cleared ${cancelledCount} pending commands from queue`);
        this.updateStatusBar();
    }

    async pauseProcessing(): Promise<void> {
        this.isProcessing = false;
        this.outputChannel.appendLine('⏸️ Command queue processing paused');
        this.updateStatusBar();
    }

    async resumeProcessing(): Promise<void> {
        this.isProcessing = true;
        this.outputChannel.appendLine('▶️ Command queue processing resumed');
        this.startProcessing();
        this.updateStatusBar();
    }

    private insertByPriority(command: QueuedCommand): void {
        const priorityOrder = { 'critical': 0, 'high': 1, 'medium': 2, 'low': 3 };
        const commandPriority = priorityOrder[command.priority];
        
        let insertIndex = this.queue.length;
        for (let i = 0; i < this.queue.length; i++) {
            const queuePriority = priorityOrder[this.queue[i].priority];
            if (commandPriority < queuePriority) {
                insertIndex = i;
                break;
            }
        }
        
        this.queue.splice(insertIndex, 0, command);
    }

    private async startProcessing(): Promise<void> {
        if (!this.isProcessing) {
            this.isProcessing = true;
        }

        while (this.isProcessing) {
            // Process commands if we have capacity
            while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
                const command = this.getNextCommand();
                if (command) {
                    this.processCommand(command);
                }
            }

            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private getNextCommand(): QueuedCommand | null {
        const now = new Date();
        
        for (let i = 0; i < this.queue.length; i++) {
            const command = this.queue[i];
            
            // Check if command is scheduled for future execution
            if (command.scheduledAt && command.scheduledAt > now) {
                continue;
            }
            
            // Remove from queue and return
            this.queue.splice(i, 1);
            return command;
        }
        
        return null;
    }

    private async processCommand(command: QueuedCommand): Promise<void> {
        command.status = 'running';
        command.startedAt = new Date();
        this.running.set(command.id, command);
        
        this.outputChannel.appendLine(`🚀 Executing command: ${command.command} (ID: ${command.id})`);
        this.eventEmitter.fire({ type: 'started', command });
        this.updateStatusBar();

        try {
            // Execute the command
            const result = await this.executeCommand(command);
            
            command.status = 'completed';
            command.completedAt = new Date();
            command.result = result;
            
            this.outputChannel.appendLine(`✅ Completed command: ${command.command} (ID: ${command.id})`);
            this.eventEmitter.fire({ type: 'completed', command });
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            command.error = errorMessage;
            
            // Retry logic
            if (command.retryCount < command.maxRetries) {
                command.retryCount++;
                command.status = 'pending';
                
                this.outputChannel.appendLine(`🔄 Retrying command: ${command.command} (ID: ${command.id}, Attempt: ${command.retryCount}/${command.maxRetries})`);
                
                // Re-queue with delay
                setTimeout(() => {
                    this.insertByPriority(command);
                    this.eventEmitter.fire({ type: 'retrying', command });
                }, 1000 * command.retryCount); // Exponential backoff
                
            } else {
                command.status = 'failed';
                command.completedAt = new Date();
                
                this.outputChannel.appendLine(`❌ Failed command: ${command.command} (ID: ${command.id}) - ${errorMessage}`);
                this.eventEmitter.fire({ type: 'failed', command });
            }
        } finally {
            this.running.delete(command.id);
            this.updateStatusBar();
        }
    }

    private async executeCommand(command: QueuedCommand): Promise<any> {
        // Map command names to actual execution
        switch (command.command) {
            case 'ruv-swarm.initializeSwarm':
                return await this.swarmManager.initializeSwarm();
                
            case 'ruv-swarm.spawnCodingAgent':
                return await this.swarmManager.spawnAgent('coder', 'vscode-assistant', ['code_analysis', 'refactoring', 'optimization']);
                
            case 'ruv-swarm.analyzeCurrentFile':
                if (command.context?.filePath) {
                    return await this.swarmManager.executeTask(
                        `Analyze ${command.context.filePath} for improvements, bugs, and optimization opportunities`,
                        'analysis',
                        command.context.filePath
                    );
                }
                throw new Error('No file path provided for analysis');
                
            case 'ruv-swarm.generateTests':
                if (command.context?.filePath) {
                    return await this.swarmManager.executeTask(
                        `Generate comprehensive unit tests for ${command.context.filePath}`,
                        'generation',
                        command.context.filePath
                    );
                }
                throw new Error('No file path provided for test generation');
                
            case 'ruv-swarm.codeReview':
                return await this.swarmManager.executeTask(
                    `Perform comprehensive code review focusing on security, performance, and maintainability`,
                    'review'
                );
                
            case 'ruv-swarm.optimizePerformance':
                if (command.context?.filePath) {
                    return await this.swarmManager.executeTask(
                        `Analyze ${command.context.filePath} for performance bottlenecks and suggest optimizations`,
                        'optimization',
                        command.context.filePath
                    );
                }
                throw new Error('No file path provided for optimization');
                
            case 'ruv-swarm.securityAnalysis':
                if (command.context?.filePath) {
                    return await this.swarmManager.executeTask(
                        `Perform security analysis of ${command.context.filePath} and identify vulnerabilities`,
                        'analysis',
                        command.context.filePath
                    );
                }
                throw new Error('No file path provided for security analysis');
                
            case 'ruv-swarm.benchmarkPerformance':
                return await this.swarmManager.executeTask(
                    'Run comprehensive performance benchmarks',
                    'analysis'
                );
                
            default:
                throw new Error(`Unknown command: ${command.command}`);
        }
    }

    private updateStatusBar(): void {
        const status = this.getQueueStatus();
        
        if (status.running > 0) {
            this.statusBarManager.updateStatus('busy', `Processing ${status.running} commands (${status.pending} queued)`);
        } else if (status.pending > 0) {
            this.statusBarManager.updateStatus('ready', `${status.pending} commands queued`);
        } else {
            this.statusBarManager.updateStatus('ready', 'RUV-Swarm Ready');
        }
    }

    dispose(): void {
        this.isProcessing = false;
        this.outputChannel.dispose();
        this.eventEmitter.dispose();
        
        // Cancel all pending commands
        this.queue.forEach(cmd => {
            cmd.status = 'cancelled';
        });
        this.queue = [];
        
        // Cancel all running commands
        this.running.forEach(cmd => {
            cmd.status = 'cancelled';
        });
        this.running.clear();
    }
}
