"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisScheduler = void 0;
class AnalysisScheduler {
    constructor() {
        this.scheduledAnalyses = new Map();
        this.config = null;
    }
    async initialize(config) {
        this.config = config;
    }
    async updateConfiguration(config) {
        this.config = config;
        // Reschedule existing analyses with new configuration
        const existingAnalyses = Array.from(this.scheduledAnalyses.values());
        this.clearAllScheduled();
        for (const analysis of existingAnalyses) {
            await this.scheduleAnalysis(analysis.context, this.config.analysisDelay);
        }
    }
    setAnalysisCallback(callback) {
        this.analysisCallback = callback;
    }
    async scheduleAnalysis(context, delay) {
        if (!this.config) {
            return;
        }
        const filePath = context.filePath;
        // Cancel existing scheduled analysis for this file
        if (this.scheduledAnalyses.has(filePath)) {
            const existing = this.scheduledAnalyses.get(filePath);
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
                }
                catch (error) {
                    console.error(`Scheduled analysis failed for ${filePath}:`, error);
                }
            }
        }, adjustedDelay);
        const scheduledAnalysis = {
            context,
            scheduledTime: new Date(Date.now() + adjustedDelay),
            timeout,
            priority: this.calculatePriority(context)
        };
        this.scheduledAnalyses.set(filePath, scheduledAnalysis);
    }
    cancelAnalysis(filePath) {
        const scheduled = this.scheduledAnalyses.get(filePath);
        if (scheduled) {
            clearTimeout(scheduled.timeout);
            this.scheduledAnalyses.delete(filePath);
            return true;
        }
        return false;
    }
    getScheduledAnalyses() {
        return Array.from(this.scheduledAnalyses.values())
            .sort((a, b) => b.priority - a.priority);
    }
    getQueueSize() {
        return this.scheduledAnalyses.size;
    }
    getPriorityMultiplier(priority) {
        switch (priority) {
            case 'critical': return 0.1; // Analyze almost immediately
            case 'high': return 0.5;
            case 'medium': return 1.0;
            case 'low': return 2.0;
            default: return 1.0;
        }
    }
    calculatePriority(context) {
        let priority = 0;
        // Priority based on change type
        switch (context.changeType) {
            case 'created':
                priority += 30;
                break;
            case 'modified':
                priority += 20;
                break;
            case 'deleted':
                priority += 10;
                break;
        }
        // Priority based on file priority
        switch (context.priority) {
            case 'critical':
                priority += 100;
                break;
            case 'high':
                priority += 50;
                break;
            case 'medium':
                priority += 25;
                break;
            case 'low':
                priority += 10;
                break;
        }
        // Priority based on complexity (inverse - simpler files get higher priority)
        priority += Math.max(10 - context.estimatedComplexity, 1);
        // Priority based on dependencies (files with more dependencies get higher priority)
        priority += Math.min(context.dependencies.length * 2, 20);
        return priority;
    }
    clearAllScheduled() {
        for (const scheduled of this.scheduledAnalyses.values()) {
            clearTimeout(scheduled.timeout);
        }
        this.scheduledAnalyses.clear();
    }
    dispose() {
        this.clearAllScheduled();
    }
}
exports.AnalysisScheduler = AnalysisScheduler;
//# sourceMappingURL=analysisScheduler.js.map