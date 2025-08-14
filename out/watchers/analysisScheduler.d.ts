import * as vscode from 'vscode';
import { AnalysisContext, WatcherConfig } from './advancedFileWatcher';
export interface ScheduledAnalysis {
    context: AnalysisContext;
    scheduledTime: Date;
    timeout: NodeJS.Timeout;
    priority: number;
}
export declare class AnalysisScheduler implements vscode.Disposable {
    private scheduledAnalyses;
    private config;
    private analysisCallback?;
    initialize(config: WatcherConfig): Promise<void>;
    updateConfiguration(config: WatcherConfig): Promise<void>;
    setAnalysisCallback(callback: (filePath: string, source: 'realtime' | 'batch') => Promise<void>): void;
    scheduleAnalysis(context: AnalysisContext, delay: number): Promise<void>;
    cancelAnalysis(filePath: string): boolean;
    getScheduledAnalyses(): ScheduledAnalysis[];
    getQueueSize(): number;
    private getPriorityMultiplier;
    private calculatePriority;
    private clearAllScheduled;
    dispose(): void;
}
//# sourceMappingURL=analysisScheduler.d.ts.map