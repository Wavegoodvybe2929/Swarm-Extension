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
exports.ProgressManager = void 0;
const vscode = __importStar(require("vscode"));
class ProgressManager {
    constructor() {
        this.activeTasks = new Map();
        this.progressReporters = new Map();
        this.eventEmitter = new vscode.EventEmitter();
        this.onProgressEvent = this.eventEmitter.event;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Progress');
    }
    async withProgress(title, task, options) {
        const taskId = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return vscode.window.withProgress({
            location: options?.location || vscode.ProgressLocation.Notification,
            title,
            cancellable: options?.cancellable || false
        }, async (progress, token) => {
            const progressTask = {
                id: taskId,
                title,
                description: options?.description,
                progress: 0,
                status: 'running',
                startTime: new Date(),
                cancellationToken: token,
                metadata: {
                    estimatedDuration: options?.estimatedDuration
                }
            };
            this.activeTasks.set(taskId, progressTask);
            this.progressReporters.set(taskId, progress);
            this.outputChannel.appendLine(`🚀 Started progress task: ${title} (ID: ${taskId})`);
            this.eventEmitter.fire({ type: 'started', task: progressTask });
            try {
                // Set up cancellation handling
                if (token.isCancellationRequested) {
                    throw new Error('Operation was cancelled');
                }
                token.onCancellationRequested(() => {
                    progressTask.status = 'cancelled';
                    progressTask.endTime = new Date();
                    this.outputChannel.appendLine(`❌ Cancelled progress task: ${title} (ID: ${taskId})`);
                    this.eventEmitter.fire({ type: 'cancelled', task: progressTask });
                    if (progressTask.onCancel) {
                        progressTask.onCancel();
                    }
                });
                // Execute the task
                const result = await task(progress, token);
                // Mark as completed
                progressTask.status = 'completed';
                progressTask.progress = 100;
                progressTask.endTime = new Date();
                const duration = progressTask.endTime.getTime() - progressTask.startTime.getTime();
                this.outputChannel.appendLine(`✅ Completed progress task: ${title} (ID: ${taskId}) in ${duration}ms`);
                this.eventEmitter.fire({ type: 'completed', task: progressTask });
                return result;
            }
            catch (error) {
                progressTask.status = 'failed';
                progressTask.endTime = new Date();
                const errorMessage = error instanceof Error ? error.message : String(error);
                const duration = progressTask.endTime.getTime() - progressTask.startTime.getTime();
                this.outputChannel.appendLine(`❌ Failed progress task: ${title} (ID: ${taskId}) after ${duration}ms - ${errorMessage}`);
                this.eventEmitter.fire({ type: 'failed', task: progressTask });
                throw error;
            }
            finally {
                this.activeTasks.delete(taskId);
                this.progressReporters.delete(taskId);
            }
        });
    }
    async createBackgroundTask(title, description, options) {
        const taskId = `bg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const progressTask = {
            id: taskId,
            title,
            description,
            progress: 0,
            status: 'running',
            startTime: new Date(),
            metadata: {
                estimatedDuration: options?.estimatedDuration,
                totalSteps: options?.totalSteps,
                currentStep: 0
            }
        };
        this.activeTasks.set(taskId, progressTask);
        this.outputChannel.appendLine(`🔄 Created background task: ${title} (ID: ${taskId})`);
        this.eventEmitter.fire({ type: 'started', task: progressTask });
        return taskId;
    }
    updateProgress(taskId, progress, message, options) {
        const task = this.activeTasks.get(taskId);
        if (!task || task.status !== 'running') {
            return;
        }
        task.progress = Math.max(0, Math.min(100, progress));
        if (options?.currentStep !== undefined && task.metadata) {
            task.metadata.currentStep = options.currentStep;
        }
        if (options?.estimatedRemainingTime !== undefined && task.metadata) {
            task.metadata.remainingTime = options.estimatedRemainingTime;
        }
        // Update progress reporter if available
        const reporter = this.progressReporters.get(taskId);
        if (reporter) {
            const increment = progress - (task.progress || 0);
            reporter.report({
                message: message || task.description,
                increment: increment > 0 ? increment : undefined
            });
        }
        this.eventEmitter.fire({ type: 'updated', task });
    }
    completeTask(taskId, message) {
        const task = this.activeTasks.get(taskId);
        if (!task) {
            return;
        }
        task.status = 'completed';
        task.progress = 100;
        task.endTime = new Date();
        const duration = task.endTime.getTime() - task.startTime.getTime();
        this.outputChannel.appendLine(`✅ Completed background task: ${task.title} (ID: ${taskId}) in ${duration}ms`);
        if (message) {
            this.outputChannel.appendLine(`   ${message}`);
        }
        this.eventEmitter.fire({ type: 'completed', task });
        // Clean up after a delay
        setTimeout(() => {
            this.activeTasks.delete(taskId);
            this.progressReporters.delete(taskId);
        }, 5000);
    }
    failTask(taskId, error) {
        const task = this.activeTasks.get(taskId);
        if (!task) {
            return;
        }
        task.status = 'failed';
        task.endTime = new Date();
        const duration = task.endTime.getTime() - task.startTime.getTime();
        this.outputChannel.appendLine(`❌ Failed background task: ${task.title} (ID: ${taskId}) after ${duration}ms - ${error}`);
        this.eventEmitter.fire({ type: 'failed', task });
        // Clean up after a delay
        setTimeout(() => {
            this.activeTasks.delete(taskId);
            this.progressReporters.delete(taskId);
        }, 10000);
    }
    cancelTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task || task.status !== 'running') {
            return false;
        }
        task.status = 'cancelled';
        task.endTime = new Date();
        this.outputChannel.appendLine(`❌ Cancelled background task: ${task.title} (ID: ${taskId})`);
        if (task.onCancel) {
            task.onCancel();
        }
        this.eventEmitter.fire({ type: 'cancelled', task });
        // Clean up immediately for cancelled tasks
        this.activeTasks.delete(taskId);
        this.progressReporters.delete(taskId);
        return true;
    }
    getActiveTasks() {
        return Array.from(this.activeTasks.values());
    }
    getTask(taskId) {
        return this.activeTasks.get(taskId);
    }
    getTaskProgress(taskId) {
        const task = this.activeTasks.get(taskId);
        return task ? task.progress : 0;
    }
    isTaskRunning(taskId) {
        const task = this.activeTasks.get(taskId);
        return task ? task.status === 'running' : false;
    }
    cancelAllTasks() {
        const taskIds = Array.from(this.activeTasks.keys());
        let cancelledCount = 0;
        for (const taskId of taskIds) {
            if (this.cancelTask(taskId)) {
                cancelledCount++;
            }
        }
        this.outputChannel.appendLine(`🗑️ Cancelled ${cancelledCount} active tasks`);
    }
    getProgressSummary() {
        const tasks = Array.from(this.activeTasks.values());
        const summary = {
            total: tasks.length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            cancelled: tasks.filter(t => t.status === 'cancelled').length,
            averageProgress: 0
        };
        if (tasks.length > 0) {
            const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
            summary.averageProgress = Math.round(totalProgress / tasks.length);
        }
        return summary;
    }
    // Utility method for creating stepped progress
    createSteppedProgress(taskId, totalSteps) {
        return {
            nextStep: (stepName) => {
                const task = this.activeTasks.get(taskId);
                if (!task || !task.metadata) {
                    return;
                }
                const currentStep = (task.metadata.currentStep || 0) + 1;
                const progress = Math.round((currentStep / totalSteps) * 100);
                this.updateProgress(taskId, progress, stepName ? `Step ${currentStep}/${totalSteps}: ${stepName}` : `Step ${currentStep}/${totalSteps}`, { currentStep });
            },
            setStep: (step, stepName) => {
                const progress = Math.round((step / totalSteps) * 100);
                this.updateProgress(taskId, progress, stepName ? `Step ${step}/${totalSteps}: ${stepName}` : `Step ${step}/${totalSteps}`, { currentStep: step });
            }
        };
    }
    dispose() {
        this.cancelAllTasks();
        this.outputChannel.dispose();
        this.eventEmitter.dispose();
        this.activeTasks.clear();
        this.progressReporters.clear();
    }
}
exports.ProgressManager = ProgressManager;
//# sourceMappingURL=progressManager.js.map