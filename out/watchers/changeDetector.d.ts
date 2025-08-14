import * as vscode from 'vscode';
import { FileChangeEvent } from './advancedFileWatcher';
export interface ChangePattern {
    type: 'bulk_edit' | 'incremental' | 'refactor' | 'new_feature' | 'bug_fix' | 'formatting';
    confidence: number;
    description: string;
    indicators: string[];
}
export interface FileHistory {
    filePath: string;
    changes: FileChangeEvent[];
    patterns: ChangePattern[];
    lastAnalyzed: Date;
}
export declare class ChangeDetector implements vscode.Disposable {
    private fileHistories;
    private readonly maxHistorySize;
    private readonly patternAnalysisWindow;
    initialize(): Promise<void>;
    analyzeChange(event: FileChangeEvent): Promise<string | undefined>;
    getFileHistory(filePath: string): FileHistory | undefined;
    getRecentPatterns(timeWindow?: number): ChangePattern[];
    clearHistory(filePath?: string): void;
    private detectPatterns;
    private getRecentChanges;
    private detectBulkEdit;
    private detectRefactoring;
    private detectNewFeature;
    private detectBugFix;
    private detectFormatting;
    private checkIndentationConsistency;
    private setupPatternDetection;
    dispose(): void;
}
//# sourceMappingURL=changeDetector.d.ts.map