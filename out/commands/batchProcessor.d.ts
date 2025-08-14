import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { ProgressManager } from '../utils/progressManager';
import { ErrorHandler } from '../utils/errorHandler';
import { CommandQueue } from './commandQueue';
export interface BatchOperation {
    id: string;
    name: string;
    description: string;
    files: string[];
    operation: 'analyze' | 'test' | 'review' | 'optimize' | 'security' | 'refactor';
    options: BatchOperationOptions;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    startTime?: Date;
    endTime?: Date;
    results: BatchOperationResult[];
    errors: string[];
}
export interface BatchOperationOptions {
    parallel: boolean;
    maxConcurrency: number;
    continueOnError: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    timeout: number;
    retries: number;
    filters?: {
        includePatterns?: string[];
        excludePatterns?: string[];
        minFileSize?: number;
        maxFileSize?: number;
        languages?: string[];
    };
}
export interface BatchOperationResult {
    filePath: string;
    success: boolean;
    result?: any;
    error?: string;
    duration: number;
    timestamp: Date;
}
export declare class BatchProcessor implements vscode.Disposable {
    private activeBatches;
    private swarmManager;
    private progressManager;
    private errorHandler;
    private commandQueue;
    private outputChannel;
    private eventEmitter;
    readonly onBatchEvent: vscode.Event<{
        type: string;
        batch: BatchOperation;
    }>;
    constructor(swarmManager: SwarmManager, progressManager: ProgressManager, errorHandler: ErrorHandler, commandQueue: CommandQueue);
    createBatchOperation(name: string, operation: BatchOperation['operation'], files: string[], options?: Partial<BatchOperationOptions>): Promise<string>;
    executeBatch(batchId: string): Promise<BatchOperation>;
    private executeParallel;
    private executeSequential;
    private processFile;
    private getCommandForOperation;
    private waitForCommandCompletion;
    private filterFiles;
    private matchesPattern;
    cancelBatch(batchId: string): Promise<boolean>;
    getBatchOperation(batchId: string): BatchOperation | undefined;
    getActiveBatches(): BatchOperation[];
    createWorkspaceBatch(operation: BatchOperation['operation'], options?: Partial<BatchOperationOptions>): Promise<string>;
    private findWorkspaceFiles;
    dispose(): void;
}
//# sourceMappingURL=batchProcessor.d.ts.map