import * as vscode from 'vscode';
export declare class DiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection;
    constructor();
    processAnalysisResult(filePath: string, analysisOutput: string): Promise<void>;
    processSecurityAnalysis(filePath: string, analysisOutput: string): Promise<void>;
    clearDiagnostics(filePath?: string): void;
    private parseAnalysisOutput;
    private parseSecurityOutput;
    private convertToVSCodeDiagnostic;
    private convertSeverity;
    private showAnalysisSummary;
    private showSecuritySummary;
    private getSeverityIcon;
    private getSecurityIcon;
    dispose(): void;
}
//# sourceMappingURL=diagnosticsProvider.d.ts.map