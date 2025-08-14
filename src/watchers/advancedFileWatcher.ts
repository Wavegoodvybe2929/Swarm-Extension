import * as vscode from 'vscode';
import * as path from 'path';
import { SwarmManager } from '../utils/swarmManager';
import { DiagnosticsProvider } from '../providers/diagnosticsProvider';
import { AnalysisScheduler } from './analysisScheduler';
import { ChangeDetector } from './changeDetector';
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

export class AdvancedFileWatcher implements vscode.Disposable {
    private swarmManager: SwarmManager;
    private diagnosticsProvider: DiagnosticsProvider;
    private analysisScheduler: AnalysisScheduler;
    private changeDetector: ChangeDetector;
    private progressManager: ProgressManager;
    private errorHandler: ErrorHandler;
    
    private fileSystemWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
    private analysisQueue: Map<string, AnalysisContext> = new Map();
    private activeAnalysis: Set<string> = new Set();
    private config: WatcherConfig;
    
    private readonly outputChannel: vscode.OutputChannel;
    private readonly statusBarItem: vscode.StatusBarItem;
    
    // Performance metrics
    private metrics = {
        filesWatched: 0,
        analysisCompleted: 0,
        analysisErrors: 0,
        averageAnalysisTime: 0,
        lastAnalysisTime: 0
    };

    constructor(
        swarmManager: SwarmManager,
        diagnosticsProvider: DiagnosticsProvider,
        progressManager: ProgressManager,
        errorHandler: ErrorHandler
    ) {
        this.swarmManager = swarmManager;
        this.diagnosticsProvider = diagnosticsProvider;
        this.progressManager = progressManager;
        this.errorHandler = errorHandler;
        
        this.analysisScheduler = new AnalysisScheduler();
        this.changeDetector = new ChangeDetector();
        
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm File Watcher');
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.config = this.loadConfiguration();
        this.updateStatusBar();
    }

    async initialize(): Promise<void> {
        try {
            this.outputChannel.appendLine('🔍 Initializing Advanced File Watcher...');
            
            if (!this.config.enabled) {
                this.outputChannel.appendLine('⏸️  File watcher is disabled');
                return;
            }

            // Initialize components
            await this.analysisScheduler.initialize(this.config);
            await this.changeDetector.initialize();
            
            // Set analysis callback
            this.analysisScheduler.setAnalysisCallback(this.analyzeFile.bind(this));
            
            // Setup workspace watchers
            await this.setupWorkspaceWatchers();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.outputChannel.appendLine('✅ Advanced File Watcher initialized successfully');
            this.statusBarItem.show();
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize file watcher: ${errorMessage}`);
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'FILE_WATCHER_INIT',
                    component: 'AdvancedFileWatcher'
                }, { severity: 'high' });
            }
        }
    }

    async updateConfiguration(newConfig: Partial<WatcherConfig>): Promise<void> {
        this.config = { ...this.config, ...newConfig };
        
        // Dispose existing watchers
        for (const watcher of this.fileSystemWatchers.values()) {
            watcher.dispose();
        }
        this.fileSystemWatchers.clear();
        
        // Reinitialize if enabled
        if (this.config.enabled) {
            await this.setupWorkspaceWatchers();
            await this.analysisScheduler.updateConfiguration(this.config);
        }
        
        this.updateStatusBar();
        this.outputChannel.appendLine('🔄 File watcher configuration updated');
    }

    async handleFileChange(event: FileChangeEvent): Promise<void> {
        try {
            // Skip if file doesn't match patterns
            if (!this.shouldWatchFile(event.uri.fsPath)) {
                return;
            }

            // Detect change patterns
            const changePattern = await this.changeDetector.analyzeChange(event);
            
            // Create analysis context
            const context = await this.createAnalysisContext(event, changePattern);
            
            // Schedule analysis
            await this.scheduleAnalysis(context);
            
            this.updateMetrics();
            this.updateStatusBar();
            
        } catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'FILE_CHANGE_HANDLER',
                    component: 'AdvancedFileWatcher',
                    filePath: event.uri.fsPath
                }, { severity: 'medium' });
            }
        }
    }

    async batchAnalyzeWorkspace(): Promise<void> {
        if (!this.config.batchAnalysis) {
            vscode.window.showWarningMessage('Batch analysis is disabled in settings');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        await this.progressManager.withProgress(
            'Batch Analyzing Workspace',
            async (progress, token) => {
                const allFiles = await this.findAllWatchedFiles();
                const totalFiles = allFiles.length;
                
                this.outputChannel.appendLine(`📊 Starting batch analysis of ${totalFiles} files`);
                
                for (let i = 0; i < totalFiles; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    
                    const file = allFiles[i];
                    const progressPercent = (i / totalFiles) * 100;
                    
                    progress.report({
                        increment: progressPercent - (i > 0 ? ((i - 1) / totalFiles) * 100 : 0),
                        message: `Analyzing ${path.basename(file)} (${i + 1}/${totalFiles})`
                    });
                    
                    await this.analyzeFile(file, 'batch');
                }
                
                this.outputChannel.appendLine('✅ Batch analysis completed');
            }
        );
    }

    getMetrics() {
        return {
            ...this.metrics,
            queueSize: this.analysisQueue.size,
            activeAnalysis: this.activeAnalysis.size,
            watchedPatterns: this.config.patterns.length
        };
    }

    private loadConfiguration(): WatcherConfig {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        const fileWatcherConfig = config.get('fileWatcher') as any || {};
        
        return {
            enabled: fileWatcherConfig.enabled ?? true,
            patterns: fileWatcherConfig.patterns ?? [
                '**/*.js', '**/*.ts', '**/*.jsx', '**/*.tsx',
                '**/*.py', '**/*.rs', '**/*.go', '**/*.java',
                '**/*.cs', '**/*.php', '**/*.rb', '**/*.cpp',
                '**/*.c', '**/*.h', '**/*.hpp'
            ],
            exclude: fileWatcherConfig.exclude ?? [
                '**/node_modules/**', '**/target/**', '**/build/**',
                '**/dist/**', '**/.git/**', '**/coverage/**'
            ],
            realTimeAnalysis: fileWatcherConfig.realTimeAnalysis ?? true,
            batchAnalysis: fileWatcherConfig.batchAnalysis ?? true,
            smartPatterns: fileWatcherConfig.smartPatterns ?? true,
            maxConcurrentAnalysis: fileWatcherConfig.maxConcurrentAnalysis ?? 3,
            analysisDelay: fileWatcherConfig.analysisDelay ?? 2000,
            workspaceWide: fileWatcherConfig.workspaceWide ?? true
        };
    }

    private async setupWorkspaceWatchers(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        for (const folder of workspaceFolders) {
            await this.setupFolderWatcher(folder);
        }
        
        this.metrics.filesWatched = this.fileSystemWatchers.size;
    }

    private async setupFolderWatcher(folder: vscode.WorkspaceFolder): Promise<void> {
        const pattern = new vscode.RelativePattern(
            folder,
            `{${this.config.patterns.join(',')}}`
        );
        
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        
        // Handle file changes
        watcher.onDidChange(async (uri) => {
            await this.handleFileChange({
                uri,
                type: 'modified',
                timestamp: new Date()
            });
        });
        
        // Handle file creation
        watcher.onDidCreate(async (uri) => {
            await this.handleFileChange({
                uri,
                type: 'created',
                timestamp: new Date()
            });
        });
        
        // Handle file deletion
        watcher.onDidDelete(async (uri) => {
            await this.handleFileChange({
                uri,
                type: 'deleted',
                timestamp: new Date()
            });
            
            // Clear diagnostics for deleted files
            this.diagnosticsProvider.clearDiagnostics(uri.fsPath);
        });
        
        this.fileSystemWatchers.set(folder.uri.fsPath, watcher);
    }

    private setupEventListeners(): void {
        // Listen to configuration changes
        vscode.workspace.onDidChangeConfiguration(async (event) => {
            if (event.affectsConfiguration('ruv-swarm.fileWatcher')) {
                const newConfig = this.loadConfiguration();
                await this.updateConfiguration(newConfig);
            }
        });
        
        // Listen to workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
            // Remove watchers for removed folders
            for (const removed of event.removed) {
                const watcher = this.fileSystemWatchers.get(removed.uri.fsPath);
                if (watcher) {
                    watcher.dispose();
                    this.fileSystemWatchers.delete(removed.uri.fsPath);
                }
            }
            
            // Add watchers for new folders
            for (const added of event.added) {
                await this.setupFolderWatcher(added);
            }
        });
    }

    private shouldWatchFile(filePath: string): boolean {
        // Check exclude patterns first
        for (const excludePattern of this.config.exclude) {
            if (this.matchesPattern(filePath, excludePattern)) {
                return false;
            }
        }
        
        // Check include patterns
        for (const includePattern of this.config.patterns) {
            if (this.matchesPattern(filePath, includePattern)) {
                return true;
            }
        }
        
        return false;
    }

    private matchesPattern(filePath: string, pattern: string): boolean {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\./g, '\\.');
        
        const regex = new RegExp(regexPattern);
        return regex.test(filePath);
    }

    private async createAnalysisContext(
        event: FileChangeEvent,
        changePattern?: string
    ): Promise<AnalysisContext> {
        const filePath = event.uri.fsPath;
        const language = this.detectLanguage(filePath);
        const priority = this.calculatePriority(event, changePattern);
        const complexity = await this.estimateComplexity(filePath);
        const dependencies = await this.findDependencies(filePath);
        
        return {
            filePath,
            language,
            changeType: event.type,
            priority,
            estimatedComplexity: complexity,
            dependencies
        };
    }

    private async scheduleAnalysis(context: AnalysisContext): Promise<void> {
        // Add to queue
        this.analysisQueue.set(context.filePath, context);
        
        // Schedule with delay if real-time analysis is enabled
        if (this.config.realTimeAnalysis) {
            await this.analysisScheduler.scheduleAnalysis(
                context,
                this.config.analysisDelay
            );
        }
    }

    private async analyzeFile(filePath: string, source: 'realtime' | 'batch'): Promise<void> {
        if (this.activeAnalysis.has(filePath)) {
            return; // Already analyzing
        }
        
        if (this.activeAnalysis.size >= this.config.maxConcurrentAnalysis) {
            return; // Too many concurrent analyses
        }
        
        this.activeAnalysis.add(filePath);
        const startTime = Date.now();
        
        try {
            this.outputChannel.appendLine(`🔍 Analyzing ${path.basename(filePath)} (${source})`);
            
            const description = `Analyze ${filePath} for code quality, performance, and potential issues`;
            const result = await this.swarmManager.executeTask(description, 'analysis', filePath);
            
            // Process results
            await this.diagnosticsProvider.processAnalysisResult(filePath, result);
            
            // Update metrics
            const analysisTime = Date.now() - startTime;
            this.metrics.analysisCompleted++;
            this.metrics.lastAnalysisTime = analysisTime;
            this.metrics.averageAnalysisTime = 
                (this.metrics.averageAnalysisTime * (this.metrics.analysisCompleted - 1) + analysisTime) / 
                this.metrics.analysisCompleted;
            
            this.outputChannel.appendLine(`✅ Analysis completed for ${path.basename(filePath)} (${analysisTime}ms)`);
            
        } catch (error) {
            this.metrics.analysisErrors++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Analysis failed for ${path.basename(filePath)}: ${errorMessage}`);
            
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'FILE_ANALYSIS',
                    component: 'AdvancedFileWatcher',
                    filePath: filePath,
                    additionalData: { source }
                }, { severity: 'medium' });
            }
            
        } finally {
            this.activeAnalysis.delete(filePath);
            this.analysisQueue.delete(filePath);
            this.updateStatusBar();
        }
    }

    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.py': 'python',
            '.rs': 'rust',
            '.go': 'go',
            '.java': 'java',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp'
        };
        
        return languageMap[ext] || 'plaintext';
    }

    private calculatePriority(
        event: FileChangeEvent,
        changePattern?: string
    ): 'low' | 'medium' | 'high' | 'critical' {
        // Critical files (config, package.json, etc.)
        const criticalPatterns = ['package.json', 'tsconfig.json', 'webpack.config.js'];
        if (criticalPatterns.some(pattern => event.uri.fsPath.includes(pattern))) {
            return 'critical';
        }
        
        // High priority for main source files
        if (event.uri.fsPath.includes('/src/') || event.uri.fsPath.includes('/lib/')) {
            return 'high';
        }
        
        // Medium priority for test files
        if (event.uri.fsPath.includes('/test/') || event.uri.fsPath.includes('spec.')) {
            return 'medium';
        }
        
        return 'low';
    }

    private async estimateComplexity(filePath: string): Promise<number> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();
            
            // Simple complexity estimation based on file size and content
            const lines = text.split('\n').length;
            const functions = (text.match(/function|def|class|interface/g) || []).length;
            const complexity = Math.min(lines / 100 + functions / 10, 10);
            
            return complexity;
        } catch {
            return 1; // Default complexity
        }
    }

    private async findDependencies(filePath: string): Promise<string[]> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();
            
            // Extract import/require statements
            const importRegex = /(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;
            const dependencies: string[] = [];
            let match;
            
            while ((match = importRegex.exec(text)) !== null) {
                const dep = match[1] || match[2];
                if (dep && !dep.startsWith('.')) {
                    dependencies.push(dep);
                }
            }
            
            return dependencies;
        } catch {
            return [];
        }
    }

    private async findAllWatchedFiles(): Promise<string[]> {
        const files: string[] = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            return files;
        }
        
        for (const folder of workspaceFolders) {
            const pattern = `{${this.config.patterns.join(',')}}`;
            const foundFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, pattern),
                `{${this.config.exclude.join(',')}}`
            );
            
            files.push(...foundFiles.map(uri => uri.fsPath));
        }
        
        return files;
    }

    private updateMetrics(): void {
        // Update metrics periodically
        // This could be expanded to include more sophisticated metrics
    }

    private updateStatusBar(): void {
        const queueSize = this.analysisQueue.size;
        const activeCount = this.activeAnalysis.size;
        
        if (!this.config.enabled) {
            this.statusBarItem.text = '$(eye-closed) File Watcher: Disabled';
            this.statusBarItem.tooltip = 'RUV-Swarm File Watcher is disabled';
        } else if (activeCount > 0) {
            this.statusBarItem.text = `$(sync~spin) Analyzing: ${activeCount}`;
            this.statusBarItem.tooltip = `Analyzing ${activeCount} files, ${queueSize} queued`;
        } else if (queueSize > 0) {
            this.statusBarItem.text = `$(clock) Queued: ${queueSize}`;
            this.statusBarItem.tooltip = `${queueSize} files queued for analysis`;
        } else {
            this.statusBarItem.text = '$(eye) File Watcher: Active';
            this.statusBarItem.tooltip = `Watching ${this.metrics.filesWatched} files`;
        }
    }

    dispose(): void {
        // Dispose all watchers
        for (const watcher of this.fileSystemWatchers.values()) {
            watcher.dispose();
        }
        this.fileSystemWatchers.clear();
        
        // Dispose components
        this.analysisScheduler.dispose();
        this.changeDetector.dispose();
        this.outputChannel.dispose();
        this.statusBarItem.dispose();
        
        // Clear queues
        this.analysisQueue.clear();
        this.activeAnalysis.clear();
    }
}
