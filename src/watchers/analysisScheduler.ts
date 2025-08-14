import * as vscode from 'vscode';
import { AnalysisContext, WatcherConfig } from './advancedFileWatcher';

export interface ScheduledAnalysis {
    context: AnalysisContext;
    scheduledTime: Date;
    timeout: NodeJS.Timeout;
    priority: number;
}

export class AnalysisScheduler implements vscode.Disposable {
    private scheduledAnalyses: Map<string, ScheduledAnalysis> = new Map();
    private config: WatcherConfig | null = null;
    private analysisCallback?: (filePath: string, source: 'realtime' | 'batch') => Promise<void>;

    async initialize(config: WatcherConfig): Promise<void> {
        this.config = config;
    }

    async updateConfiguration(config: WatcherConfig): Promise<void> {
        this.config = config;
        
        // Reschedule existing analyses with new configuration
        const existingAnalyses = Array.from(this.scheduledAnalyses.values());
        this.clearAllScheduled();
        
        for (const analysis of existingAnalyses) {
            await this.scheduleAnalysis(analysis.context, this.config.analysisDelay);
        }
    }

    setAnalysisCallback(callback: (filePath: string, source: 'realtime' | 'batch') => Promise<void>): void {
        this.analysisCallback = callback;
    }

    async scheduleAnalysis(context: AnalysisContext, delay: number): Promise<void> {
        if (!this.config) {
            return;
        }

        const filePath = context.filePath;
        
        // Cancel existing scheduled analysis for this file
        if (this.scheduledAnalyses.has(filePath)) {
            const existing = this.scheduledAnalyses.get(filePath)!;
            clearTimeout(existing.timeout);
            this.scheduledAnalyses.delete(filePath);
        }

        // Calculate priority-based delay
        const priorityMultiplier = this.getPriorityMultiplier(context.priority);
        const adjustedDelay = Math.max(delay * priorityMultiplier, 100);

        // Schedule new analysis
        const timeout = setTimeout(async () => {
            this.scheduledAnalyses.delete(filePath);
            
            if (this.analysisCallback) {
                try {
                    await this.analysisCallback(filePath, 'realtime');
                } catch (error) {
                    console.error(`Scheduled analysis failed for ${filePath}:`, error);
                }
            }
        }, adjustedDelay);

        const scheduledAnalysis: ScheduledAnalysis = {
            context,
            scheduledTime: new Date(Date.now() + adjustedDelay),
            timeout,
            priority: this.calculatePriority(context)
        };

        this.scheduledAnalyses.set(filePath, scheduledAnalysis);
    }

    cancelAnalysis(filePath: string): boolean {
        const scheduled = this.scheduledAnalyses.get(filePath);
        if (scheduled) {
            clearTimeout(scheduled.timeout);
            this.scheduledAnalyses.delete(filePath);
            return true;
        }
        return false;
    }

    getScheduledAnalyses(): ScheduledAnalysis[] {
        return Array.from(this.scheduledAnalyses.values())
            .sort((a, b) => b.priority - a.priority);
    }

    getQueueSize(): number {
        return this.scheduledAnalyses.size;
    }

    private getPriorityMultiplier(priority: string): number {
        switch (priority) {
            case 'critical': return 0.1; // Analyze almost immediately
            case 'high': return 0.5;
            case 'medium': return 1.0;
            case 'low': return 2.0;
            default: return 1.0;
        }
    }

    private calculatePriority(context: AnalysisContext): number {
        let priority = 0;
        
        // Priority based on change type
        switch (context.changeType) {
            case 'created': priority += 30; break;
            case 'modified': priority += 20; break;
            case 'deleted': priority += 10; break;
        }
        
        // Priority based on file priority
        switch (context.priority) {
            case 'critical': priority += 100; break;
            case 'high': priority += 50; break;
            case 'medium': priority += 25; break;
            case 'low': priority += 10; break;
        }
        
        // Priority based on complexity (inverse - simpler files get higher priority)
        priority += Math.max(10 - context.estimatedComplexity, 1);
        
        // Priority based on dependencies (files with more dependencies get higher priority)
        priority += Math.min(context.dependencies.length * 2, 20);
        
        return priority;
    }

    private clearAllScheduled(): void {
        for (const scheduled of this.scheduledAnalyses.values()) {
            clearTimeout(scheduled.timeout);
        }
        this.scheduledAnalyses.clear();
    }

    dispose(): void {
        this.clearAllScheduled();
    }
}
