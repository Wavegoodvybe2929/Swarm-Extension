import * as vscode from 'vscode';
export interface ProgressTask {
    id: string;
    title: string;
    description?: string;
    progress: number;
    status: 'running' | 'completed' | 'failed' | 'cancelled';
    startTime: Date;
    endTime?: Date;
    cancellationToken?: vscode.CancellationToken;
    onCancel?: () => void;
    metadata?: {
        totalSteps?: number;
        currentStep?: number;
        estimatedDuration?: number;
        remainingTime?: number;
    };
}
export declare class ProgressManager implements vscode.Disposable {
    private activeTasks;
    private progressReporters;
    private eventEmitter;
    private outputChannel;
    readonly onProgressEvent: vscode.Event<{
        type: string;
        task: ProgressTask;
    }>;
    constructor();
    withProgress<T>(title: string, task: (progress: vscode.Progress<{
        message?: string;
        increment?: number;
    }>, token: vscode.CancellationToken) => Promise<T>, options?: {
        location?: vscode.ProgressLocation;
        cancellable?: boolean;
        description?: string;
        estimatedDuration?: number;
    }): Promise<T>;
    createBackgroundTask(title: string, description?: string, options?: {
        cancellable?: boolean;
        estimatedDuration?: number;
        totalSteps?: number;
    }): Promise<string>;
    updateProgress(taskId: string, progress: number, message?: string, options?: {
        currentStep?: number;
        estimatedRemainingTime?: number;
    }): void;
    completeTask(taskId: string, message?: string): void;
    failTask(taskId: string, error: string): void;
    cancelTask(taskId: string): boolean;
    getActiveTasks(): ProgressTask[];
    getTask(taskId: string): ProgressTask | undefined;
    getTaskProgress(taskId: string): number;
    isTaskRunning(taskId: string): boolean;
    cancelAllTasks(): void;
    getProgressSummary(): {
        total: number;
        running: number;
        completed: number;
        failed: number;
        cancelled: number;
        averageProgress: number;
    };
    createSteppedProgress(taskId: string, totalSteps: number): {
        nextStep: (stepName?: string) => void;
        setStep: (step: number, stepName?: string) => void;
    };
    dispose(): void;
}
//# sourceMappingURL=progressManager.d.ts.map