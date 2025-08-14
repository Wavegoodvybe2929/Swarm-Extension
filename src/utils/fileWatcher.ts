import * as vscode from 'vscode';
import { SwarmManager } from './swarmManager';
import { DiagnosticsProvider } from '../providers/diagnosticsProvider';

export class FileWatcher implements vscode.Disposable {
    private swarmManager: SwarmManager;
    private diagnosticsProvider: DiagnosticsProvider;
    private fileSystemWatcher?: vscode.FileSystemWatcher;
    private debounceMap = new Map<string, NodeJS.Timeout>();
    private config: any;

    constructor(swarmManager: SwarmManager, diagnosticsProvider: DiagnosticsProvider) {
        this.swarmManager = swarmManager;
        this.diagnosticsProvider = diagnosticsProvider;
    }

    async initialize(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        this.config = config.get('fileWatcher', {
            enabled: true,
            patterns: ['**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx', '**/*.py', '**/*.rs', '**/*.go', '**/*.java', '**/*.cs'],
            exclude: ['**/node_modules/**', '**/target/**', '**/build/**', '**/dist/**']
        });

        if (this.config.enabled) {
            this.setupFileWatcher();
        }
    }

    updateConfiguration(newConfig: any): void {
        this.config = newConfig;
        
        // Dispose existing watcher
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }
        
        // Setup new watcher if enabled
        if (this.config.enabled) {
            this.setupFileWatcher();
        }
    }

    async handleFileChange(uri: vscode.Uri): Promise<void> {
        const filePath = uri.fsPath;
        
        // Check if file matches patterns
        if (!this.shouldWatchFile(filePath)) {
            return;
        }

        // Debounce the analysis
        this.debounceAnalysis(filePath);
    }

    private setupFileWatcher(): void {
        // Create pattern from configuration
        const pattern = `{${this.config.patterns.join(',')}}`;
        
        this.fileSystemWatcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        // Watch for file changes
        this.fileSystemWatcher.onDidChange(async (uri) => {
            await this.handleFileChange(uri);
        });
        
        // Watch for new files
        this.fileSystemWatcher.onDidCreate(async (uri) => {
            await this.handleFileChange(uri);
        });
    }

    private shouldWatchFile(filePath: string): boolean {
        // Check exclude patterns
        for (const excludePattern of this.config.exclude) {
            const regex = this.globToRegex(excludePattern);
            if (regex.test(filePath)) {
                return false;
            }
        }
        
        // Check include patterns
        for (const includePattern of this.config.patterns) {
            const regex = this.globToRegex(includePattern);
            if (regex.test(filePath)) {
                return true;
            }
        }
        
        return false;
    }

    private debounceAnalysis(filePath: string): void {
        // Clear existing timeout
        if (this.debounceMap.has(filePath)) {
            clearTimeout(this.debounceMap.get(filePath)!);
        }

        // Get debounce delay from configuration
        const autoAnalyzeConfig = vscode.workspace.getConfiguration('ruv-swarm').get('autoAnalyze', {
            enabled: true,
            debounceMs: 2000
        });

        if (!autoAnalyzeConfig.enabled) {
            return;
        }

        // Set new timeout
        const timeout = setTimeout(async () => {
            await this.analyzeFile(filePath);
            this.debounceMap.delete(filePath);
        }, autoAnalyzeConfig.debounceMs);

        this.debounceMap.set(filePath, timeout);
    }

    private async analyzeFile(filePath: string): Promise<void> {
        try {
            console.log(`🔍 Auto-analyzing file: ${filePath}`);
            
            const description = `Analyze ${filePath} for code quality, performance, and potential issues`;
            const result = await this.swarmManager.executeTask(description, 'analysis', filePath);
            
            // Process the analysis result
            await this.diagnosticsProvider.processAnalysisResult(filePath, result);
            
            console.log(`✅ Auto-analysis completed for: ${filePath}`);
            
        } catch (error) {
            console.error(`❌ Auto-analysis failed for ${filePath}:`, error);
            
            // Clear any existing diagnostics for this file on error
            this.diagnosticsProvider.clearDiagnostics(filePath);
        }
    }

    private globToRegex(glob: string): RegExp {
        // Convert glob pattern to regex
        let regex = glob
            .replace(/\*\*/g, '.*')  // ** matches any number of directories
            .replace(/\*/g, '[^/]*') // * matches any characters except /
            .replace(/\?/g, '[^/]')  // ? matches any single character except /
            .replace(/\./g, '\\.');   // Escape dots
        
        return new RegExp(regex);
    }

    dispose(): void {
        // Clear all debounce timeouts
        for (const timeout of this.debounceMap.values()) {
            clearTimeout(timeout);
        }
        this.debounceMap.clear();
        
        // Dispose file system watcher
        if (this.fileSystemWatcher) {
            this.fileSystemWatcher.dispose();
        }
    }
}
