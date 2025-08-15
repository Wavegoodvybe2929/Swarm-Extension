"use strict";
/**
 * Code Understanding Pipeline - Intelligent code analysis optimized for Gemma-3-4B
 * Provides context-aware code understanding with smart chunking and analysis
 */
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
exports.CodeUnderstandingPipeline = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class CodeUnderstandingPipeline {
    constructor(context, swarmManager, toolsProvider) {
        this._chunkCache = new Map();
        this._analysisCache = new Map();
        this._dependencyGraph = new Map();
        this._context = context;
        this._swarmManager = swarmManager;
        this._toolsProvider = toolsProvider;
        this._outputChannel = vscode.window.createOutputChannel('RUV-Swarm Code Understanding');
        this._config = this._loadConfiguration();
        this._setupConfigurationWatcher();
    }
    _loadConfiguration() {
        const config = vscode.workspace.getConfiguration('ruv-swarm.codeUnderstanding');
        return {
            maxChunkSize: config.get('maxChunkSize', 100), // lines
            overlapLines: config.get('overlapLines', 5),
            contextPreservation: config.get('contextPreservation', true),
            smartChunking: config.get('smartChunking', true),
            parallelProcessing: config.get('parallelProcessing', true),
            cacheResults: config.get('cacheResults', true),
            gemmaOptimizations: {
                useContextCompression: config.get('gemmaOptimizations.useContextCompression', true),
                prioritizeRecent: config.get('gemmaOptimizations.prioritizeRecent', true),
                adaptiveChunking: config.get('gemmaOptimizations.adaptiveChunking', true),
                tokenBudgetManagement: config.get('gemmaOptimizations.tokenBudgetManagement', true)
            }
        };
    }
    _setupConfigurationWatcher() {
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('ruv-swarm.codeUnderstanding')) {
                this._config = this._loadConfiguration();
                this._outputChannel.appendLine('Code understanding pipeline configuration updated');
            }
        });
    }
    /**
     * Analyze code with intelligent chunking and context management
     */
    async analyzeCode(filePaths, analysisContext) {
        const startTime = Date.now();
        let chunksProcessed = 0;
        let tokensUsed = 0;
        let cacheHits = 0;
        try {
            this._outputChannel.appendLine(`🔍 Starting code analysis for ${filePaths.length} files`);
            // Step 1: Chunk the code intelligently
            const chunks = await this._chunkFiles(filePaths, analysisContext);
            this._outputChannel.appendLine(`📦 Created ${chunks.length} code chunks`);
            // Step 2: Build dependency graph
            await this._buildDependencyGraph(chunks);
            // Step 3: Prioritize chunks based on Gemma-3-4B constraints
            const prioritizedChunks = this._prioritizeChunks(chunks, analysisContext);
            // Step 4: Analyze chunks with context awareness
            const insights = [];
            const architecturalPatterns = [];
            const dependencies = {};
            for (const chunk of prioritizedChunks) {
                const cacheKey = this._generateCacheKey(chunk, analysisContext);
                if (this._config.cacheResults && this._analysisCache.has(cacheKey)) {
                    cacheHits++;
                    const cachedResult = this._analysisCache.get(cacheKey);
                    insights.push(...cachedResult.insights);
                    continue;
                }
                const chunkAnalysis = await this._analyzeChunk(chunk, analysisContext);
                insights.push(...chunkAnalysis.insights);
                architecturalPatterns.push(...chunkAnalysis.patterns);
                if (chunkAnalysis.dependencies) {
                    dependencies[chunk.filePath] = chunkAnalysis.dependencies;
                }
                chunksProcessed++;
                tokensUsed += chunkAnalysis.tokensUsed || 0;
                // Cache the result
                if (this._config.cacheResults) {
                    this._analysisCache.set(cacheKey, chunkAnalysis);
                }
                // Respect token budget for Gemma-3-4B
                if (this._config.gemmaOptimizations.tokenBudgetManagement &&
                    tokensUsed > analysisContext.maxTokens * 0.8) {
                    this._outputChannel.appendLine('⚠️ Approaching token budget limit, optimizing remaining analysis');
                    break;
                }
            }
            // Step 5: Synthesize results
            const summary = await this._generateSummary(insights, analysisContext);
            const recommendations = await this._generateRecommendations(insights, analysisContext);
            // Step 6: Calculate architecture metrics
            const architecture = this._calculateArchitectureMetrics(chunks, dependencies, architecturalPatterns);
            const result = {
                summary,
                insights: this._deduplicateInsights(insights),
                architecture,
                recommendations,
                performance: {
                    analysisTime: Date.now() - startTime,
                    chunksProcessed,
                    tokensUsed,
                    cacheHits
                }
            };
            this._outputChannel.appendLine(`✅ Analysis completed: ${insights.length} insights, ${recommendations.length} recommendations`);
            return result;
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Analysis failed: ${error}`);
            throw error;
        }
    }
    /**
     * Analyze a single file with context
     */
    async analyzeFile(filePath, analysisContext = {}) {
        const fullContext = {
            workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            targetFiles: [filePath],
            maxTokens: 2048,
            contextWindow: 8192,
            analysisDepth: 'medium',
            focusAreas: ['quality', 'maintainability'],
            ...analysisContext
        };
        return this.analyzeCode([filePath], fullContext);
    }
    /**
     * Get code context for AI model
     */
    async getCodeContext(filePath, lineNumber, contextLines = 20) {
        try {
            const fileContent = await this._toolsProvider.executeTool('read_file', { filePath });
            if (!fileContent.content || fileContent.isError) {
                throw new Error(`Failed to read file: ${filePath}`);
            }
            const contentItem = fileContent.content[0];
            if (contentItem.type !== 'text') {
                throw new Error(`Expected text content, got ${contentItem.type}`);
            }
            const lines = contentItem.text.split('\n');
            if (lineNumber !== undefined) {
                // Get context around specific line
                const start = Math.max(0, lineNumber - contextLines);
                const end = Math.min(lines.length, lineNumber + contextLines);
                return lines.slice(start, end).map((line, index) => {
                    const actualLineNumber = start + index + 1;
                    const marker = actualLineNumber === lineNumber ? '>>> ' : '    ';
                    return `${marker}${actualLineNumber}: ${line}`;
                }).join('\n');
            }
            else {
                // Return optimized context for Gemma-3-4B
                return this._optimizeContextForGemma(lines.join('\n'), filePath);
            }
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Failed to get code context: ${error}`);
            throw error;
        }
    }
    /**
     * Smart chunking optimized for Gemma-3-4B
     */
    async _chunkFiles(filePaths, analysisContext) {
        const chunks = [];
        for (const filePath of filePaths) {
            const cacheKey = `chunks:${filePath}`;
            if (this._config.cacheResults && this._chunkCache.has(cacheKey)) {
                chunks.push(...this._chunkCache.get(cacheKey));
                continue;
            }
            try {
                const fileResult = await this._toolsProvider.executeTool('read_file', { filePath });
                if (fileResult.isError) {
                    this._outputChannel.appendLine(`⚠️ Skipping file due to error: ${filePath}`);
                    continue;
                }
                const contentItem = fileResult.content[0];
                if (contentItem.type !== 'text') {
                    this._outputChannel.appendLine(`⚠️ Skipping non-text file: ${filePath}`);
                    continue;
                }
                const content = JSON.parse(contentItem.text).content;
                const fileChunks = this._config.smartChunking
                    ? await this._smartChunkFile(filePath, content, analysisContext)
                    : this._simpleChunkFile(filePath, content);
                chunks.push(...fileChunks);
                if (this._config.cacheResults) {
                    this._chunkCache.set(cacheKey, fileChunks);
                }
            }
            catch (error) {
                this._outputChannel.appendLine(`❌ Error chunking file ${filePath}: ${error}`);
            }
        }
        return chunks;
    }
    async _smartChunkFile(filePath, content, analysisContext) {
        const chunks = [];
        const lines = content.split('\n');
        const language = this._detectLanguage(filePath);
        // Use swarm to identify logical boundaries
        try {
            const structureAnalysis = await this._swarmManager.executeTask(`Analyze code structure and identify logical boundaries in ${filePath}`, 'analysis', filePath);
            // Parse structure analysis to create intelligent chunks
            // This is a simplified implementation
            let currentChunk = {
                filePath,
                startLine: 1,
                content: '',
                dependencies: [],
                metadata: { language }
            };
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                currentChunk.content += line + '\n';
                // Check if we should create a new chunk
                if (this._shouldCreateNewChunk(line, i, lines, language)) {
                    currentChunk.endLine = i + 1;
                    currentChunk.id = `${filePath}:${currentChunk.startLine}-${currentChunk.endLine}`;
                    currentChunk.type = this._detectChunkType(currentChunk.content, language);
                    currentChunk.complexity = this._calculateComplexity(currentChunk.content);
                    chunks.push(currentChunk);
                    // Start new chunk with overlap
                    const overlapStart = Math.max(currentChunk.startLine, i + 1 - this._config.overlapLines);
                    currentChunk = {
                        filePath,
                        startLine: overlapStart,
                        content: lines.slice(overlapStart - 1, i + 1).join('\n') + '\n',
                        dependencies: [],
                        metadata: { language }
                    };
                }
            }
            // Add final chunk
            if (currentChunk.content) {
                currentChunk.endLine = lines.length;
                currentChunk.id = `${filePath}:${currentChunk.startLine}-${currentChunk.endLine}`;
                currentChunk.type = this._detectChunkType(currentChunk.content, language);
                currentChunk.complexity = this._calculateComplexity(currentChunk.content);
                chunks.push(currentChunk);
            }
        }
        catch (error) {
            this._outputChannel.appendLine(`⚠️ Smart chunking failed, falling back to simple chunking: ${error}`);
            return this._simpleChunkFile(filePath, content);
        }
        return chunks;
    }
    _simpleChunkFile(filePath, content) {
        const chunks = [];
        const lines = content.split('\n');
        const language = this._detectLanguage(filePath);
        for (let i = 0; i < lines.length; i += this._config.maxChunkSize) {
            const startLine = i + 1;
            const endLine = Math.min(i + this._config.maxChunkSize, lines.length);
            const chunkContent = lines.slice(i, endLine).join('\n');
            chunks.push({
                id: `${filePath}:${startLine}-${endLine}`,
                filePath,
                startLine,
                endLine,
                content: chunkContent,
                type: 'block',
                complexity: this._calculateComplexity(chunkContent),
                dependencies: [],
                metadata: { language }
            });
        }
        return chunks;
    }
    _prioritizeChunks(chunks, analysisContext) {
        if (!this._config.gemmaOptimizations.prioritizeRecent) {
            return chunks;
        }
        // Sort by complexity and recency for Gemma-3-4B optimization
        return chunks.sort((a, b) => {
            // Prioritize higher complexity (more important code)
            const complexityDiff = b.complexity - a.complexity;
            if (Math.abs(complexityDiff) > 0.1) {
                return complexityDiff;
            }
            // Then prioritize by file modification time (if available)
            // This would require file stats
            return 0;
        });
    }
    async _analyzeChunk(chunk, analysisContext) {
        try {
            // Use swarm for detailed analysis
            const analysis = await this._swarmManager.executeTask(`Analyze code chunk for ${analysisContext.focusAreas.join(', ')} in ${chunk.filePath} lines ${chunk.startLine}-${chunk.endLine}`, 'analysis', chunk.filePath);
            // Extract insights from analysis
            const insights = this._extractInsights(analysis, chunk);
            const patterns = this._extractPatterns(analysis, chunk);
            const dependencies = this._extractDependencies(chunk.content, chunk.metadata.language);
            return {
                insights,
                patterns,
                dependencies,
                tokensUsed: this._estimateTokens(chunk.content)
            };
        }
        catch (error) {
            this._outputChannel.appendLine(`❌ Chunk analysis failed: ${error}`);
            return {
                insights: [],
                patterns: [],
                dependencies: [],
                tokensUsed: 0
            };
        }
    }
    async _buildDependencyGraph(chunks) {
        this._dependencyGraph.clear();
        for (const chunk of chunks) {
            const dependencies = this._extractDependencies(chunk.content, chunk.metadata.language);
            this._dependencyGraph.set(chunk.id, new Set(dependencies));
        }
    }
    _optimizeContextForGemma(content, filePath) {
        if (!this._config.gemmaOptimizations.useContextCompression) {
            return content;
        }
        // Implement context compression for Gemma-3-4B
        const lines = content.split('\n');
        const language = this._detectLanguage(filePath);
        // Remove comments and empty lines for compression
        const compressedLines = lines.filter(line => {
            const trimmed = line.trim();
            if (!trimmed)
                return false;
            // Language-specific comment removal
            switch (language) {
                case 'typescript':
                case 'javascript':
                    return !trimmed.startsWith('//') && !trimmed.startsWith('/*');
                case 'python':
                    return !trimmed.startsWith('#');
                default:
                    return true;
            }
        });
        // Add line numbers for context
        return compressedLines.map((line, index) => `${index + 1}: ${line}`).join('\n');
    }
    _detectLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.rs': 'rust',
            '.go': 'go',
            '.java': 'java',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c'
        };
        return languageMap[ext] || 'unknown';
    }
    _shouldCreateNewChunk(line, lineIndex, allLines, language) {
        // Check if we've reached max chunk size
        if (lineIndex > 0 && lineIndex % this._config.maxChunkSize === 0) {
            return true;
        }
        // Language-specific logical boundaries
        const trimmed = line.trim();
        switch (language) {
            case 'typescript':
            case 'javascript':
                return trimmed.startsWith('function ') ||
                    trimmed.startsWith('class ') ||
                    trimmed.startsWith('interface ') ||
                    trimmed.startsWith('export ');
            case 'python':
                return trimmed.startsWith('def ') ||
                    trimmed.startsWith('class ') ||
                    (trimmed.startsWith('if __name__') && trimmed.includes('__main__'));
            default:
                return false;
        }
    }
    _detectChunkType(content, language) {
        const trimmed = content.trim();
        if (trimmed.includes('function ') || trimmed.includes('def ')) {
            return 'function';
        }
        if (trimmed.includes('class ')) {
            return 'class';
        }
        if (trimmed.includes('interface ') || trimmed.includes('type ')) {
            return 'interface';
        }
        if (trimmed.includes('module ') || trimmed.includes('namespace ')) {
            return 'module';
        }
        return 'block';
    }
    _calculateComplexity(content) {
        // Simple complexity calculation based on control structures
        const controlKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch'];
        let complexity = 1; // Base complexity
        for (const keyword of controlKeywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = content.match(regex);
            if (matches) {
                complexity += matches.length;
            }
        }
        return Math.min(complexity / 10, 1); // Normalize to 0-1
    }
    _extractDependencies(content, language) {
        const dependencies = [];
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            switch (language) {
                case 'typescript':
                case 'javascript':
                    if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) {
                        const match = trimmed.match(/['"`]([^'"`]+)['"`]/);
                        if (match) {
                            dependencies.push(match[1]);
                        }
                    }
                    break;
                case 'python':
                    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
                        const parts = trimmed.split(' ');
                        if (parts.length > 1) {
                            dependencies.push(parts[1]);
                        }
                    }
                    break;
            }
        }
        return dependencies;
    }
    _extractInsights(analysis, chunk) {
        // Extract insights from swarm analysis
        // This would parse the analysis result and create structured insights
        return [];
    }
    _extractPatterns(analysis, chunk) {
        // Extract architectural patterns from analysis
        return [];
    }
    async _generateSummary(insights, analysisContext) {
        const criticalIssues = insights.filter(i => i.severity === 'critical').length;
        const warnings = insights.filter(i => i.severity === 'warning').length;
        const suggestions = insights.filter(i => i.type === 'suggestion').length;
        return `Analysis of ${analysisContext.targetFiles.length} files completed. ` +
            `Found ${criticalIssues} critical issues, ${warnings} warnings, and ${suggestions} suggestions.`;
    }
    async _generateRecommendations(insights, analysisContext) {
        const recommendations = [];
        // Generate recommendations based on insights
        const criticalInsights = insights.filter(i => i.severity === 'critical');
        if (criticalInsights.length > 0) {
            recommendations.push('Address critical issues immediately to prevent potential failures');
        }
        const securityInsights = insights.filter(i => i.type === 'issue' && i.description.toLowerCase().includes('security'));
        if (securityInsights.length > 0) {
            recommendations.push('Review and fix security vulnerabilities');
        }
        return recommendations;
    }
    _calculateArchitectureMetrics(chunks, dependencies, patterns) {
        const totalComplexity = chunks.reduce((sum, chunk) => sum + chunk.complexity, 0);
        const avgComplexity = totalComplexity / chunks.length;
        return {
            patterns: [...new Set(patterns)],
            dependencies,
            complexity: avgComplexity,
            maintainability: Math.max(0, 1 - avgComplexity) // Inverse relationship
        };
    }
    _deduplicateInsights(insights) {
        const seen = new Set();
        return insights.filter(insight => {
            const key = `${insight.type}:${insight.title}:${insight.location.filePath}:${insight.location.startLine}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }
    _generateCacheKey(chunk, analysisContext) {
        return `${chunk.id}:${analysisContext.analysisDepth}:${analysisContext.focusAreas.join(',')}`;
    }
    _estimateTokens(content) {
        // Rough token estimation (1 token ≈ 4 characters for English text)
        return Math.ceil(content.length / 4);
    }
    dispose() {
        this._outputChannel.dispose();
        this._chunkCache.clear();
        this._analysisCache.clear();
        this._dependencyGraph.clear();
    }
}
exports.CodeUnderstandingPipeline = CodeUnderstandingPipeline;
//# sourceMappingURL=codeUnderstandingPipeline.js.map