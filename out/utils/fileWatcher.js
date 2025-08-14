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
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
class FileWatcher {
    constructor(swarmManager, diagnosticsProvider) {
        this.debounceMap = new Map();
        this.swarmManager = swarmManager;
        this.diagnosticsProvider = diagnosticsProvider;
    }
    async initialize() {
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
    updateConfiguration(newConfig) {
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
    async handleFileChange(uri) {
        const filePath = uri.fsPath;
        // Check if file matches patterns
        if (!this.shouldWatchFile(filePath)) {
            return;
        }
        // Debounce the analysis
        this.debounceAnalysis(filePath);
    }
    setupFileWatcher() {
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
    shouldWatchFile(filePath) {
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
    debounceAnalysis(filePath) {
        // Clear existing timeout
        if (this.debounceMap.has(filePath)) {
            clearTimeout(this.debounceMap.get(filePath));
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
    async analyzeFile(filePath) {
        try {
            console.log(`🔍 Auto-analyzing file: ${filePath}`);
            const description = `Analyze ${filePath} for code quality, performance, and potential issues`;
            const result = await this.swarmManager.executeTask(description, 'analysis', filePath);
            // Process the analysis result
            await this.diagnosticsProvider.processAnalysisResult(filePath, result);
            console.log(`✅ Auto-analysis completed for: ${filePath}`);
        }
        catch (error) {
            console.error(`❌ Auto-analysis failed for ${filePath}:`, error);
            // Clear any existing diagnostics for this file on error
            this.diagnosticsProvider.clearDiagnostics(filePath);
        }
    }
    globToRegex(glob) {
        // Convert glob pattern to regex
        let regex = glob
            .replace(/\*\*/g, '.*') // ** matches any number of directories
            .replace(/\*/g, '[^/]*') // * matches any characters except /
            .replace(/\?/g, '[^/]') // ? matches any single character except /
            .replace(/\./g, '\\.'); // Escape dots
        return new RegExp(regex);
    }
    dispose() {
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
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=fileWatcher.js.map