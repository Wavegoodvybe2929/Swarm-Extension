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
exports.BatchProcessor = void 0;
const vscode = __importStar(require("vscode"));
class BatchProcessor {
    constructor(swarmManager, progressManager, errorHandler, commandQueue) {
        this.activeBatches = new Map();
        this.eventEmitter = new vscode.EventEmitter();
        this.onBatchEvent = this.eventEmitter.event;
        this.swarmManager = swarmManager;
        this.progressManager = progressManager;
        this.errorHandler = errorHandler;
        this.commandQueue = commandQueue;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Batch Processor');
    }
    async createBatchOperation(name, operation, files, options = {}) {
        const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const defaultOptions = {
            parallel: true,
            maxConcurrency: 3,
            continueOnError: true,
            priority: 'medium',
            timeout: 60000,
            retries: 2,
            ...options
        };
        // Filter files based on options
        const filteredFiles = this.filterFiles(files, defaultOptions.filters);
        const batch = {
            id: batchId,
            name,
            description: `${operation} operation on ${filteredFiles.length} files`,
            files: filteredFiles,
            operation,
            options: defaultOptions,
            status: 'pending',
            progress: 0,
            results: [],
            errors: []
        };
        this.activeBatches.set(batchId, batch);
        this.outputChannel.appendLine(`📦 Created batch operation: ${name} (ID: ${batchId})`);
        this.outputChannel.appendLine(`   Operation: ${operation}`);
        this.outputChannel.appendLine(`   Files: ${filteredFiles.length}`);
        this.outputChannel.appendLine(`   Parallel: ${defaultOptions.parallel}`);
        this.outputChannel.appendLine(`   Max Concurrency: ${defaultOptions.maxConcurrency}`);
        this.eventEmitter.fire({ type: 'created', batch });
        return batchId;
    }
    async executeBatch(batchId) {
        const batch = this.activeBatches.get(batchId);
        if (!batch) {
            throw new Error(`Batch operation not found: ${batchId}`);
        }
        if (batch.status !== 'pending') {
            throw new Error(`Batch operation is not in pending state: ${batch.status}`);
        }
        batch.status = 'running';
        batch.startTime = new Date();
        batch.progress = 0;
        this.outputChannel.appendLine(`🚀 Starting batch operation: ${batch.name} (ID: ${batchId})`);
        this.eventEmitter.fire({ type: 'started', batch });
        try {
            // Create progress task
            const progressTaskId = await this.progressManager.createBackgroundTask(`Batch ${batch.operation}`, batch.description, {
                totalSteps: batch.files.length,
                estimatedDuration: batch.files.length * 5000 // Rough estimate
            });
            const progressHelper = this.progressManager.createSteppedProgress(progressTaskId, batch.files.length);
            if (batch.options.parallel) {
                await this.executeParallel(batch, progressHelper);
            }
            else {
                await this.executeSequential(batch, progressHelper);
            }
            // Complete the batch
            batch.status = 'completed';
            batch.endTime = new Date();
            batch.progress = 100;
            this.progressManager.completeTask(progressTaskId, `Processed ${batch.results.length} files`);
            const duration = batch.endTime.getTime() - (batch.startTime?.getTime() || 0);
            const successCount = batch.results.filter(r => r.success).length;
            const failureCount = batch.results.filter(r => !r.success).length;
            this.outputChannel.appendLine(`✅ Completed batch operation: ${batch.name} (ID: ${batchId})`);
            this.outputChannel.appendLine(`   Duration: ${duration}ms`);
            this.outputChannel.appendLine(`   Successful: ${successCount}`);
            this.outputChannel.appendLine(`   Failed: ${failureCount}`);
            this.eventEmitter.fire({ type: 'completed', batch });
        }
        catch (error) {
            batch.status = 'failed';
            batch.endTime = new Date();
            const errorMessage = error instanceof Error ? error.message : String(error);
            batch.errors.push(errorMessage);
            this.outputChannel.appendLine(`❌ Failed batch operation: ${batch.name} (ID: ${batchId}) - ${errorMessage}`);
            await this.errorHandler.handleError(error instanceof Error ? error : new Error(errorMessage), {
                operation: 'batch_execution',
                component: 'BatchProcessor',
                additionalData: { batchId, operation: batch.operation, fileCount: batch.files.length }
            });
            this.eventEmitter.fire({ type: 'failed', batch });
        }
        return batch;
    }
    async executeParallel(batch, progressHelper) {
        const semaphore = new Semaphore(batch.options.maxConcurrency);
        const promises = [];
        for (let i = 0; i < batch.files.length; i++) {
            const filePath = batch.files[i];
            const fileIndex = i;
            const promise = semaphore.acquire().then(async (release) => {
                try {
                    await this.processFile(batch, filePath, fileIndex);
                    progressHelper.setStep(fileIndex + 1, `Processed ${filePath}`);
                }
                finally {
                    release();
                }
            });
            promises.push(promise);
        }
        await Promise.all(promises);
    }
    async executeSequential(batch, progressHelper) {
        for (let i = 0; i < batch.files.length; i++) {
            const filePath = batch.files[i];
            try {
                await this.processFile(batch, filePath, i);
                progressHelper.setStep(i + 1, `Processed ${filePath}`);
            }
            catch (error) {
                if (!batch.options.continueOnError) {
                    throw error;
                }
            }
        }
    }
    async processFile(batch, filePath, index) {
        const startTime = Date.now();
        try {
            this.outputChannel.appendLine(`   Processing file ${index + 1}/${batch.files.length}: ${filePath}`);
            // Queue the command for execution
            const commandId = await this.commandQueue.enqueue(this.getCommandForOperation(batch.operation), [], batch.options.priority, {
                maxRetries: batch.options.retries,
                context: {
                    filePath,
                    workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
                }
            });
            // Wait for command completion (simplified - in real implementation, would listen to events)
            await this.waitForCommandCompletion(commandId, batch.options.timeout);
            const duration = Date.now() - startTime;
            const result = {
                filePath,
                success: true,
                result: `${batch.operation} completed successfully`,
                duration,
                timestamp: new Date()
            };
            batch.results.push(result);
            batch.progress = Math.round(((index + 1) / batch.files.length) * 100);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            const result = {
                filePath,
                success: false,
                error: errorMessage,
                duration,
                timestamp: new Date()
            };
            batch.results.push(result);
            batch.errors.push(`${filePath}: ${errorMessage}`);
            this.outputChannel.appendLine(`   ❌ Failed to process ${filePath}: ${errorMessage}`);
            if (!batch.options.continueOnError) {
                throw error;
            }
        }
    }
    getCommandForOperation(operation) {
        switch (operation) {
            case 'analyze':
                return 'ruv-swarm.analyzeCurrentFile';
            case 'test':
                return 'ruv-swarm.generateTests';
            case 'review':
                return 'ruv-swarm.codeReview';
            case 'optimize':
                return 'ruv-swarm.optimizePerformance';
            case 'security':
                return 'ruv-swarm.securityAnalysis';
            case 'refactor':
                return 'ruv-swarm.refactorCode';
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    async waitForCommandCompletion(commandId, timeout) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkStatus = () => {
                const queueStatus = this.commandQueue.getQueueStatus();
                const command = queueStatus.commands.find(cmd => cmd.id === commandId);
                if (!command) {
                    resolve(); // Command completed and removed from queue
                    return;
                }
                if (command.status === 'completed') {
                    resolve();
                    return;
                }
                if (command.status === 'failed' || command.status === 'cancelled') {
                    reject(new Error(command.error || 'Command failed'));
                    return;
                }
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Command timeout'));
                    return;
                }
                // Check again in 100ms
                setTimeout(checkStatus, 100);
            };
            checkStatus();
        });
    }
    filterFiles(files, filters) {
        if (!filters) {
            return files;
        }
        return files.filter(filePath => {
            // Include patterns
            if (filters.includePatterns && filters.includePatterns.length > 0) {
                const included = filters.includePatterns.some(pattern => this.matchesPattern(filePath, pattern));
                if (!included) {
                    return false;
                }
            }
            // Exclude patterns
            if (filters.excludePatterns && filters.excludePatterns.length > 0) {
                const excluded = filters.excludePatterns.some(pattern => this.matchesPattern(filePath, pattern));
                if (excluded) {
                    return false;
                }
            }
            // Language filter
            if (filters.languages && filters.languages.length > 0) {
                const extension = filePath.split('.').pop()?.toLowerCase();
                const languageMap = {
                    'javascript': ['js', 'jsx', 'mjs'],
                    'typescript': ['ts', 'tsx'],
                    'python': ['py', 'pyx'],
                    'rust': ['rs'],
                    'go': ['go'],
                    'java': ['java'],
                    'csharp': ['cs'],
                    'cpp': ['cpp', 'cc', 'cxx', 'c++'],
                    'c': ['c', 'h']
                };
                const matchesLanguage = filters.languages.some(lang => {
                    const extensions = languageMap[lang.toLowerCase()] || [lang.toLowerCase()];
                    return extension && extensions.includes(extension);
                });
                if (!matchesLanguage) {
                    return false;
                }
            }
            return true;
        });
    }
    matchesPattern(filePath, pattern) {
        // Simple glob pattern matching
        const regex = new RegExp(pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]'));
        return regex.test(filePath);
    }
    async cancelBatch(batchId) {
        const batch = this.activeBatches.get(batchId);
        if (!batch || batch.status !== 'running') {
            return false;
        }
        batch.status = 'cancelled';
        batch.endTime = new Date();
        this.outputChannel.appendLine(`❌ Cancelled batch operation: ${batch.name} (ID: ${batchId})`);
        this.eventEmitter.fire({ type: 'cancelled', batch });
        return true;
    }
    getBatchOperation(batchId) {
        return this.activeBatches.get(batchId);
    }
    getActiveBatches() {
        return Array.from(this.activeBatches.values());
    }
    async createWorkspaceBatch(operation, options = {}) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder found');
        }
        // Find all relevant files in workspace
        const files = await this.findWorkspaceFiles(workspaceFolder.uri, options.filters);
        return this.createBatchOperation(`Workspace ${operation}`, operation, files, options);
    }
    async findWorkspaceFiles(workspaceUri, filters) {
        const defaultPatterns = [
            '**/*.js',
            '**/*.jsx',
            '**/*.ts',
            '**/*.tsx',
            '**/*.py',
            '**/*.rs',
            '**/*.go',
            '**/*.java',
            '**/*.cs',
            '**/*.cpp',
            '**/*.c',
            '**/*.h'
        ];
        const includePatterns = filters?.includePatterns || defaultPatterns;
        const excludePatterns = filters?.excludePatterns || [
            '**/node_modules/**',
            '**/target/**',
            '**/build/**',
            '**/dist/**',
            '**/.git/**',
            '**/coverage/**'
        ];
        const files = [];
        for (const pattern of includePatterns) {
            const foundFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(workspaceUri, pattern), new vscode.RelativePattern(workspaceUri, `{${excludePatterns.join(',')}}`));
            files.push(...foundFiles.map(uri => uri.fsPath));
        }
        // Remove duplicates
        return [...new Set(files)];
    }
    dispose() {
        this.outputChannel.dispose();
        this.eventEmitter.dispose();
        // Cancel all active batches
        for (const batch of this.activeBatches.values()) {
            if (batch.status === 'running') {
                batch.status = 'cancelled';
                batch.endTime = new Date();
            }
        }
        this.activeBatches.clear();
    }
}
exports.BatchProcessor = BatchProcessor;
// Simple semaphore implementation for controlling concurrency
class Semaphore {
    constructor(permits) {
        this.waitQueue = [];
        this.permits = permits;
    }
    async acquire() {
        return new Promise((resolve) => {
            if (this.permits > 0) {
                this.permits--;
                resolve(() => this.release());
            }
            else {
                this.waitQueue.push(() => {
                    this.permits--;
                    resolve(() => this.release());
                });
            }
        });
    }
    release() {
        this.permits++;
        if (this.waitQueue.length > 0) {
            const next = this.waitQueue.shift();
            if (next) {
                next();
            }
        }
    }
}
//# sourceMappingURL=batchProcessor.js.map