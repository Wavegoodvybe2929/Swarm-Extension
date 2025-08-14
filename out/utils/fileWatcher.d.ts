import * as vscode from 'vscode';
import { SwarmManager } from './swarmManager';
import { DiagnosticsProvider } from '../providers/diagnosticsProvider';
export declare class FileWatcher implements vscode.Disposable {
    private swarmManager;
    private diagnosticsProvider;
    private fileSystemWatcher?;
    private debounceMap;
    private config;
    constructor(swarmManager: SwarmManager, diagnosticsProvider: DiagnosticsProvider);
    initialize(): Promise<void>;
    updateConfiguration(newConfig: any): void;
    handleFileChange(uri: vscode.Uri): Promise<void>;
    private setupFileWatcher;
    private shouldWatchFile;
    private debounceAnalysis;
    private analyzeFile;
    private globToRegex;
    dispose(): void;
}
//# sourceMappingURL=fileWatcher.d.ts.map