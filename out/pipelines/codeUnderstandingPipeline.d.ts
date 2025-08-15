/**
 * Code Understanding Pipeline - Intelligent code analysis optimized for Gemma-3-4B
 * Provides context-aware code understanding with smart chunking and analysis
 */
import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { SwarmToolsProvider } from '../mcp/tools/swarmToolsProvider';
export interface CodeChunk {
    id: string;
    filePath: string;
    startLine: number;
    endLine: number;
    content: string;
    type: 'function' | 'class' | 'interface' | 'module' | 'block';
    complexity: number;
    dependencies: string[];
    metadata: Record<string, any>;
}
export interface AnalysisContext {
    workspaceRoot: string;
    targetFiles: string[];
    maxTokens: number;
    contextWindow: number;
    analysisDepth: 'shallow' | 'medium' | 'deep';
    focusAreas: string[];
}
export interface CodeInsight {
    type: 'pattern' | 'issue' | 'suggestion' | 'dependency' | 'architecture';
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    description: string;
    location: {
        filePath: string;
        startLine: number;
        endLine: number;
    };
    relatedFiles: string[];
    confidence: number;
    actionable: boolean;
    suggestedFix?: string;
}
export interface UnderstandingResult {
    summary: string;
    insights: CodeInsight[];
    architecture: {
        patterns: string[];
        dependencies: Record<string, string[]>;
        complexity: number;
        maintainability: number;
    };
    recommendations: string[];
    performance: {
        analysisTime: number;
        chunksProcessed: number;
        tokensUsed: number;
        cacheHits: number;
    };
}
export interface PipelineConfig {
    maxChunkSize: number;
    overlapLines: number;
    contextPreservation: boolean;
    smartChunking: boolean;
    parallelProcessing: boolean;
    cacheResults: boolean;
    gemmaOptimizations: {
        useContextCompression: boolean;
        prioritizeRecent: boolean;
        adaptiveChunking: boolean;
        tokenBudgetManagement: boolean;
    };
}
export declare class CodeUnderstandingPipeline {
    private _swarmManager;
    private _toolsProvider;
    private _context;
    private _outputChannel;
    private _config;
    private _chunkCache;
    private _analysisCache;
    private _dependencyGraph;
    constructor(context: vscode.ExtensionContext, swarmManager: SwarmManager, toolsProvider: SwarmToolsProvider);
    private _loadConfiguration;
    private _setupConfigurationWatcher;
    /**
     * Analyze code with intelligent chunking and context management
     */
    analyzeCode(filePaths: string[], analysisContext: AnalysisContext): Promise<UnderstandingResult>;
    /**
     * Analyze a single file with context
     */
    analyzeFile(filePath: string, analysisContext?: Partial<AnalysisContext>): Promise<UnderstandingResult>;
    /**
     * Get code context for AI model
     */
    getCodeContext(filePath: string, lineNumber?: number, contextLines?: number): Promise<string>;
    /**
     * Smart chunking optimized for Gemma-3-4B
     */
    private _chunkFiles;
    private _smartChunkFile;
    private _simpleChunkFile;
    private _prioritizeChunks;
    private _analyzeChunk;
    private _buildDependencyGraph;
    private _optimizeContextForGemma;
    private _detectLanguage;
    private _shouldCreateNewChunk;
    private _detectChunkType;
    private _calculateComplexity;
    private _extractDependencies;
    private _extractInsights;
    private _extractPatterns;
    private _generateSummary;
    private _generateRecommendations;
    private _calculateArchitectureMetrics;
    private _deduplicateInsights;
    private _generateCacheKey;
    private _estimateTokens;
    dispose(): void;
}
//# sourceMappingURL=codeUnderstandingPipeline.d.ts.map