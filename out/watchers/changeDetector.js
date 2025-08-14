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
exports.ChangeDetector = void 0;
const vscode = __importStar(require("vscode"));
class ChangeDetector {
    constructor() {
        this.fileHistories = new Map();
        this.maxHistorySize = 50;
        this.patternAnalysisWindow = 5 * 60 * 1000; // 5 minutes
    }
    async initialize() {
        // Initialize change detection patterns
        this.setupPatternDetection();
    }
    async analyzeChange(event) {
        const filePath = event.uri.fsPath;
        // Get or create file history
        let history = this.fileHistories.get(filePath);
        if (!history) {
            history = {
                filePath,
                changes: [],
                patterns: [],
                lastAnalyzed: new Date()
            };
            this.fileHistories.set(filePath, history);
        }
        // Add current change to history
        history.changes.push(event);
        // Limit history size
        if (history.changes.length > this.maxHistorySize) {
            history.changes = history.changes.slice(-this.maxHistorySize);
        }
        // Analyze patterns
        const patterns = await this.detectPatterns(history);
        history.patterns = patterns;
        history.lastAnalyzed = new Date();
        // Return the most confident pattern
        const bestPattern = patterns.reduce((best, current) => current.confidence > best.confidence ? current : best, { confidence: 0, type: 'incremental', description: '', indicators: [] });
        return bestPattern.confidence > 0.5 ? bestPattern.type : undefined;
    }
    getFileHistory(filePath) {
        return this.fileHistories.get(filePath);
    }
    getRecentPatterns(timeWindow = this.patternAnalysisWindow) {
        const cutoff = new Date(Date.now() - timeWindow);
        const patterns = [];
        for (const history of this.fileHistories.values()) {
            if (history.lastAnalyzed > cutoff) {
                patterns.push(...history.patterns);
            }
        }
        return patterns.sort((a, b) => b.confidence - a.confidence);
    }
    clearHistory(filePath) {
        if (filePath) {
            this.fileHistories.delete(filePath);
        }
        else {
            this.fileHistories.clear();
        }
    }
    async detectPatterns(history) {
        const patterns = [];
        const recentChanges = this.getRecentChanges(history.changes);
        if (recentChanges.length === 0) {
            return patterns;
        }
        // Detect bulk edit pattern
        const bulkEditPattern = await this.detectBulkEdit(recentChanges, history.filePath);
        if (bulkEditPattern) {
            patterns.push(bulkEditPattern);
        }
        // Detect refactoring pattern
        const refactorPattern = await this.detectRefactoring(recentChanges, history.filePath);
        if (refactorPattern) {
            patterns.push(refactorPattern);
        }
        // Detect new feature pattern
        const newFeaturePattern = await this.detectNewFeature(recentChanges, history.filePath);
        if (newFeaturePattern) {
            patterns.push(newFeaturePattern);
        }
        // Detect bug fix pattern
        const bugFixPattern = await this.detectBugFix(recentChanges, history.filePath);
        if (bugFixPattern) {
            patterns.push(bugFixPattern);
        }
        // Detect formatting pattern
        const formattingPattern = await this.detectFormatting(recentChanges, history.filePath);
        if (formattingPattern) {
            patterns.push(formattingPattern);
        }
        // Default to incremental if no specific pattern detected
        if (patterns.length === 0) {
            patterns.push({
                type: 'incremental',
                confidence: 0.7,
                description: 'Incremental code changes',
                indicators: ['regular_edits']
            });
        }
        return patterns;
    }
    getRecentChanges(changes) {
        const cutoff = new Date(Date.now() - this.patternAnalysisWindow);
        return changes.filter(change => change.timestamp > cutoff);
    }
    async detectBulkEdit(changes, filePath) {
        // Detect if there are many rapid changes
        if (changes.length < 5) {
            return null;
        }
        const timeSpan = changes[changes.length - 1].timestamp.getTime() - changes[0].timestamp.getTime();
        const changesPerMinute = (changes.length / timeSpan) * 60000;
        if (changesPerMinute > 10) {
            return {
                type: 'bulk_edit',
                confidence: Math.min(changesPerMinute / 20, 0.95),
                description: 'Rapid bulk editing detected',
                indicators: ['high_frequency_changes', 'short_time_span']
            };
        }
        return null;
    }
    async detectRefactoring(changes, filePath) {
        try {
            // Check if file content suggests refactoring
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText().toLowerCase();
            const refactorIndicators = [
                'rename', 'extract', 'move', 'reorganize', 'restructure',
                'refactor', 'cleanup', 'optimize', 'simplify'
            ];
            const indicatorCount = refactorIndicators.filter(indicator => text.includes(indicator) ||
                changes.some(change => change.uri.fsPath.toLowerCase().includes(indicator))).length;
            if (indicatorCount > 0 && changes.length >= 3) {
                return {
                    type: 'refactor',
                    confidence: Math.min(indicatorCount / refactorIndicators.length + 0.3, 0.9),
                    description: 'Code refactoring activity detected',
                    indicators: refactorIndicators.filter(indicator => text.includes(indicator))
                };
            }
        }
        catch (error) {
            // File might not be accessible
        }
        return null;
    }
    async detectNewFeature(changes, filePath) {
        // Check if this is a new file or has significant additions
        const hasNewFile = changes.some(change => change.type === 'created');
        if (hasNewFile) {
            return {
                type: 'new_feature',
                confidence: 0.8,
                description: 'New feature development detected',
                indicators: ['new_file_created']
            };
        }
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText().toLowerCase();
            const featureIndicators = [
                'feature', 'add', 'implement', 'create', 'build',
                'develop', 'introduce', 'enhancement'
            ];
            const indicatorCount = featureIndicators.filter(indicator => text.includes(indicator)).length;
            if (indicatorCount > 1 && changes.length >= 2) {
                return {
                    type: 'new_feature',
                    confidence: Math.min(indicatorCount / featureIndicators.length + 0.4, 0.85),
                    description: 'New feature development activity',
                    indicators: featureIndicators.filter(indicator => text.includes(indicator))
                };
            }
        }
        catch (error) {
            // File might not be accessible
        }
        return null;
    }
    async detectBugFix(changes, filePath) {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText().toLowerCase();
            const bugFixIndicators = [
                'fix', 'bug', 'error', 'issue', 'problem',
                'correct', 'resolve', 'patch', 'hotfix'
            ];
            const indicatorCount = bugFixIndicators.filter(indicator => text.includes(indicator)).length;
            if (indicatorCount > 0 && changes.length <= 3) {
                return {
                    type: 'bug_fix',
                    confidence: Math.min(indicatorCount / bugFixIndicators.length + 0.5, 0.9),
                    description: 'Bug fix activity detected',
                    indicators: bugFixIndicators.filter(indicator => text.includes(indicator))
                };
            }
        }
        catch (error) {
            // File might not be accessible
        }
        return null;
    }
    async detectFormatting(changes, filePath) {
        // Formatting is typically characterized by many small, rapid changes
        if (changes.length < 3) {
            return null;
        }
        const timeSpan = changes[changes.length - 1].timestamp.getTime() - changes[0].timestamp.getTime();
        const isRapid = timeSpan < 30000; // Less than 30 seconds
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const text = document.getText();
            // Check for formatting-related patterns
            const hasConsistentIndentation = this.checkIndentationConsistency(text);
            const hasFormattingKeywords = /format|prettier|eslint|tslint/.test(text.toLowerCase());
            if (isRapid && (hasConsistentIndentation || hasFormattingKeywords)) {
                return {
                    type: 'formatting',
                    confidence: 0.75,
                    description: 'Code formatting activity detected',
                    indicators: ['rapid_changes', 'consistent_formatting']
                };
            }
        }
        catch (error) {
            // File might not be accessible
        }
        return null;
    }
    checkIndentationConsistency(text) {
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length < 5) {
            return false;
        }
        const indentations = lines.map(line => {
            const match = line.match(/^(\s*)/);
            return match ? match[1].length : 0;
        });
        // Check if indentations follow a consistent pattern
        const uniqueIndents = [...new Set(indentations)].sort((a, b) => a - b);
        // If there are consistent indent levels, it suggests formatting
        return uniqueIndents.length <= Math.max(3, lines.length / 10);
    }
    setupPatternDetection() {
        // Setup any additional pattern detection logic
        // This could include ML models or more sophisticated analysis
    }
    dispose() {
        this.fileHistories.clear();
    }
}
exports.ChangeDetector = ChangeDetector;
//# sourceMappingURL=changeDetector.js.map