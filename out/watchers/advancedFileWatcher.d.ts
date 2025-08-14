import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { DiagnosticsProvider } from '../providers/diagnosticsProvider';
import { ProgressManager } from '../utils/progressManager';
import { ErrorHandler } from '../utils/errorHandler';
export interface WatcherConfig {
    enabled: boolean;
    patterns: string[];
    exclude: string[];
    realTimeAnalysis: boolean;
    batchAnalysis: boolean;
    smartPatterns: boolean;
    maxConcurrentAnalysis: number;
    analysisDelay: number;
    workspaceWide: boolean;
}
export interface FileChangeEvent {
    uri: vscode.Uri;
    type: 'created' | 'modified' | 'deleted';
    timestamp: Date;
    size?: number;
    language?: string;
    changePattern?: string;
}
export interface AnalysisContext {
    filePath: string;
    language: string;
    changeType: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedComplexity: number;
    dependencies: string[];
}
export declare class AdvancedFileWatcher implements vscode.Disposable {
    private swarmManager;
    private diagnosticsProvider;
    private analysisScheduler;
    private changeDetector;
    private progressManager;
    private errorHandler;
    private fileSystemWatchers;
    private analysisQueue;
    private activeAnalysis;
    private config;
    private readonly outputChannel;
    private readonly statusBarItem;
    private metrics;
    constructor(swarmManager: SwarmManager, diagnosticsProvider: DiagnosticsProvider, progressManager: ProgressManager, errorHandler: ErrorHandler);
    initialize(): Promise<void>;
    updateConfiguration(newConfig: Partial<WatcherConfig>): Promise<void>;
    handleFileChange(event: FileChangeEvent): Promise<void>;
    batchAnalyzeWorkspace(): Promise<void>;
    getMetrics(): {
        queueSize: number;
        activeAnalysis: number;
        watchedPatterns: number;
        filesWatched: number;
        analysisCompleted: number;
        analysisErrors: number;
        averageAnalysisTime: number;
        lastAnalysisTime: number;
    };
    private loadConfiguration;
    private setupWorkspaceWatchers;
    private setupFolderWatcher;
    private setupEventListeners;
    private shouldWatchFile;
    private matchesPattern;
    private createAnalysisContext;
    private scheduleAnalysis;
    private analyzeFile;
    private detectLanguage;
    private calculatePriority;
    private estimateComplexity;
    private findDependencies;
    private findAllWatchedFiles;
    private updateMetrics;
    private updateStatusBar;
    dispose(): void;
}
//# sourceMappingURL=advancedFileWatcher.d.ts.map