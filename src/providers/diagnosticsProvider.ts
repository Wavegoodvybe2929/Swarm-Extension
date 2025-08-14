import * as vscode from 'vscode';
import { Diagnostic, AnalysisResult, DiagnosticSeverity } from '../types';

export class DiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ruv-swarm');
    }

    async processAnalysisResult(filePath: string, analysisOutput: string): Promise<void> {
        try {
            // Parse the analysis output and convert to VSCode diagnostics
            const diagnostics = this.parseAnalysisOutput(analysisOutput);
            
            const uri = vscode.Uri.file(filePath);
            const vscDiagnostics = diagnostics.map(diag => this.convertToVSCodeDiagnostic(diag));
            
            this.diagnosticCollection.set(uri, vscDiagnostics);
            
            // Show summary in output channel
            this.showAnalysisSummary(filePath, diagnostics);
            
        } catch (error) {
            console.error('Failed to process analysis result:', error);
            vscode.window.showErrorMessage('Failed to process analysis results');
        }
    }

    async processSecurityAnalysis(filePath: string, analysisOutput: string): Promise<void> {
        try {
            // Parse security-specific analysis
            const securityDiagnostics = this.parseSecurityOutput(analysisOutput);
            
            const uri = vscode.Uri.file(filePath);
            const vscDiagnostics = securityDiagnostics.map(diag => this.convertToVSCodeDiagnostic(diag));
            
            // Add security-specific styling
            const securityDiagnosticsWithTags = vscDiagnostics.map(diag => {
                diag.tags = [vscode.DiagnosticTag.Deprecated]; // Use as security indicator
                return diag;
            });
            
            this.diagnosticCollection.set(uri, securityDiagnosticsWithTags);
            
            // Show security summary
            this.showSecuritySummary(filePath, securityDiagnostics);
            
        } catch (error) {
            console.error('Failed to process security analysis:', error);
            vscode.window.showErrorMessage('Failed to process security analysis results');
        }
    }

    clearDiagnostics(filePath?: string): void {
        if (filePath) {
            const uri = vscode.Uri.file(filePath);
            this.diagnosticCollection.delete(uri);
        } else {
            this.diagnosticCollection.clear();
        }
    }

    private parseAnalysisOutput(output: string): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(output);
            if (parsed.diagnostics && Array.isArray(parsed.diagnostics)) {
                return parsed.diagnostics;
            }
        } catch {
            // Fall back to text parsing
        }
        
        // Parse text-based output
        const lines = output.split('\n');
        let currentDiagnostic: Partial<Diagnostic> | null = null;
        
        for (const line of lines) {
            // Look for error/warning patterns
            const errorMatch = line.match(/❌\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const warningMatch = line.match(/⚠️\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const infoMatch = line.match(/💡\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            
            if (errorMatch) {
                diagnostics.push({
                    severity: 'error',
                    message: errorMatch[1].trim(),
                    line: errorMatch[2] ? parseInt(errorMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm',
                    category: 'logic'
                });
            } else if (warningMatch) {
                diagnostics.push({
                    severity: 'warning',
                    message: warningMatch[1].trim(),
                    line: warningMatch[2] ? parseInt(warningMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm',
                    category: 'performance'
                });
            } else if (infoMatch) {
                diagnostics.push({
                    severity: 'info',
                    message: infoMatch[1].trim(),
                    line: infoMatch[2] ? parseInt(infoMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm',
                    category: 'maintainability'
                });
            }
        }
        
        return diagnostics;
    }

    private parseSecurityOutput(output: string): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        
        // Parse security-specific patterns
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Look for security vulnerability patterns
            const criticalMatch = line.match(/🔴\s*Critical:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const highMatch = line.match(/🟠\s*High:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const mediumMatch = line.match(/🟡\s*Medium:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            const lowMatch = line.match(/🟢\s*Low:\s*(.+?)(?:\s*\(line\s*(\d+)\))?/);
            
            if (criticalMatch) {
                diagnostics.push({
                    severity: 'error',
                    message: `Security: ${criticalMatch[1].trim()}`,
                    line: criticalMatch[2] ? parseInt(criticalMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-security',
                    category: 'security',
                    code: 'CRITICAL_SECURITY'
                });
            } else if (highMatch) {
                diagnostics.push({
                    severity: 'error',
                    message: `Security: ${highMatch[1].trim()}`,
                    line: highMatch[2] ? parseInt(highMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-security',
                    category: 'security',
                    code: 'HIGH_SECURITY'
                });
            } else if (mediumMatch) {
                diagnostics.push({
                    severity: 'warning',
                    message: `Security: ${mediumMatch[1].trim()}`,
                    line: mediumMatch[2] ? parseInt(mediumMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-security',
                    category: 'security',
                    code: 'MEDIUM_SECURITY'
                });
            } else if (lowMatch) {
                diagnostics.push({
                    severity: 'info',
                    message: `Security: ${lowMatch[1].trim()}`,
                    line: lowMatch[2] ? parseInt(lowMatch[2]) - 1 : 0,
                    column: 0,
                    source: 'ruv-swarm-security',
                    category: 'security',
                    code: 'LOW_SECURITY'
                });
            }
        }
        
        return diagnostics;
    }

    private convertToVSCodeDiagnostic(diagnostic: Diagnostic): vscode.Diagnostic {
        const range = new vscode.Range(
            diagnostic.line,
            diagnostic.column,
            diagnostic.endLine || diagnostic.line,
            diagnostic.endColumn || diagnostic.column + 1
        );
        
        const severity = this.convertSeverity(diagnostic.severity);
        
        const vscDiagnostic = new vscode.Diagnostic(
            range,
            diagnostic.message,
            severity
        );
        
        vscDiagnostic.source = diagnostic.source;
        vscDiagnostic.code = diagnostic.code;
        
        return vscDiagnostic;
    }

    private convertSeverity(severity: DiagnosticSeverity): vscode.DiagnosticSeverity {
        switch (severity) {
            case 'error':
                return vscode.DiagnosticSeverity.Error;
            case 'warning':
                return vscode.DiagnosticSeverity.Warning;
            case 'info':
                return vscode.DiagnosticSeverity.Information;
            case 'hint':
                return vscode.DiagnosticSeverity.Hint;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

    private showAnalysisSummary(filePath: string, diagnostics: Diagnostic[]): void {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Analysis');
        
        const errorCount = diagnostics.filter(d => d.severity === 'error').length;
        const warningCount = diagnostics.filter(d => d.severity === 'warning').length;
        const infoCount = diagnostics.filter(d => d.severity === 'info').length;
        
        outputChannel.clear();
        outputChannel.appendLine('🧠 RUV-Swarm Analysis Results');
        outputChannel.appendLine('================================');
        outputChannel.appendLine(`File: ${filePath}`);
        outputChannel.appendLine(`Timestamp: ${new Date().toLocaleString()}`);
        outputChannel.appendLine('');
        outputChannel.appendLine('📊 Summary:');
        outputChannel.appendLine(`  ❌ Errors: ${errorCount}`);
        outputChannel.appendLine(`  ⚠️  Warnings: ${warningCount}`);
        outputChannel.appendLine(`  💡 Info: ${infoCount}`);
        outputChannel.appendLine('');
        
        if (diagnostics.length > 0) {
            outputChannel.appendLine('🔍 Issues Found:');
            diagnostics.forEach((diag, index) => {
                const icon = this.getSeverityIcon(diag.severity);
                outputChannel.appendLine(`  ${icon} Line ${diag.line + 1}: ${diag.message}`);
            });
        } else {
            outputChannel.appendLine('✅ No issues found!');
        }
        
        outputChannel.show();
    }

    private showSecuritySummary(filePath: string, diagnostics: Diagnostic[]): void {
        const outputChannel = vscode.window.createOutputChannel('RUV-Swarm Security');
        
        const criticalCount = diagnostics.filter(d => d.code === 'CRITICAL_SECURITY').length;
        const highCount = diagnostics.filter(d => d.code === 'HIGH_SECURITY').length;
        const mediumCount = diagnostics.filter(d => d.code === 'MEDIUM_SECURITY').length;
        const lowCount = diagnostics.filter(d => d.code === 'LOW_SECURITY').length;
        
        outputChannel.clear();
        outputChannel.appendLine('🔒 RUV-Swarm Security Analysis');
        outputChannel.appendLine('===============================');
        outputChannel.appendLine(`File: ${filePath}`);
        outputChannel.appendLine(`Timestamp: ${new Date().toLocaleString()}`);
        outputChannel.appendLine('');
        outputChannel.appendLine('🛡️  Security Summary:');
        outputChannel.appendLine(`  🔴 Critical: ${criticalCount}`);
        outputChannel.appendLine(`  🟠 High: ${highCount}`);
        outputChannel.appendLine(`  🟡 Medium: ${mediumCount}`);
        outputChannel.appendLine(`  🟢 Low: ${lowCount}`);
        outputChannel.appendLine('');
        
        if (diagnostics.length > 0) {
            outputChannel.appendLine('🚨 Security Issues:');
            diagnostics.forEach((diag, index) => {
                const icon = this.getSecurityIcon(diag.code || '');
                outputChannel.appendLine(`  ${icon} Line ${diag.line + 1}: ${diag.message}`);
            });
        } else {
            outputChannel.appendLine('✅ No security issues found!');
        }
        
        outputChannel.show();
    }

    private getSeverityIcon(severity: DiagnosticSeverity): string {
        switch (severity) {
            case 'error': return '❌';
            case 'warning': return '⚠️';
            case 'info': return '💡';
            case 'hint': return '💭';
            default: return '📝';
        }
    }

    private getSecurityIcon(code: string): string {
        switch (code) {
            case 'CRITICAL_SECURITY': return '🔴';
            case 'HIGH_SECURITY': return '🟠';
            case 'MEDIUM_SECURITY': return '🟡';
            case 'LOW_SECURITY': return '🟢';
            default: return '🔍';
        }
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
