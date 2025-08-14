import * as vscode from 'vscode';
import { Diagnostic, DiagnosticSeverity, DiagnosticCategory } from '../types';
import { ErrorHandler } from '../utils/errorHandler';
import { SwarmManager } from '../utils/swarmManager';
export interface DiagnosticRule {
    id: string;
    name: string;
    description: string;
    category: DiagnosticCategory;
    severity: DiagnosticSeverity;
    languages: string[];
    pattern?: RegExp;
    customCheck?: (text: string, filePath: string) => Promise<Diagnostic[]>;
    enabled: boolean;
    priority: number;
}
export interface FixSuggestion {
    id: string;
    diagnosticId: string;
    title: string;
    description: string;
    kind: vscode.CodeActionKind;
    edit?: vscode.WorkspaceEdit;
    command?: vscode.Command;
    isPreferred?: boolean;
}
export interface DiagnosticContext {
    filePath: string;
    language: string;
    document: vscode.TextDocument;
    workspaceFolder?: vscode.WorkspaceFolder;
    projectType?: string;
    dependencies?: string[];
}
export declare class AdvancedDiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection;
    private swarmManager;
    private errorHandler;
    private rules;
    private fixSuggestions;
    private analysisCache;
    private readonly outputChannel;
    private cacheTimeout;
    constructor(swarmManager: SwarmManager, errorHandler: ErrorHandler);
    initialize(): Promise<void>;
    analyzeDocument(document: vscode.TextDocument): Promise<Diagnostic[]>;
    batchAnalyzeWorkspace(): Promise<Map<string, Diagnostic[]>>;
    addCustomRule(rule: DiagnosticRule): void;
    removeRule(ruleId: string): boolean;
    enableRule(ruleId: string): boolean;
    disableRule(ruleId: string): boolean;
    getRules(): DiagnosticRule[];
    getEnabledRules(): DiagnosticRule[];
    addFixSuggestion(diagnosticId: string, suggestion: FixSuggestion): void;
    getFixSuggestions(diagnosticId: string): FixSuggestion[];
    clearDiagnostics(filePath?: string): void;
    private createDiagnosticContext;
    private runRuleBasedAnalysis;
    private applyRule;
    private runAIAnalysis;
    private parseAIAnalysisResult;
    private runLanguageSpecificAnalysis;
    private analyzeJavaScript;
    private analyzePython;
    private analyzeRust;
    private updateVSCodeDiagnostics;
    private convertToVSCodeDiagnostic;
    private convertSeverity;
    private detectProjectType;
    private extractDependencies;
    private findAnalyzableFiles;
    private initializeDefaultRules;
    private loadCustomRules;
    private registerCodeActionProvider;
    dispose(): void;
}
//# sourceMappingURL=advancedDiagnosticsProvider.d.ts.map