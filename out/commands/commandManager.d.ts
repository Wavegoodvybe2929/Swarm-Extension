import { SwarmManager } from '../utils/swarmManager';
import { DiagnosticsProvider } from '../providers/diagnosticsProvider';
import { StatusBarManager } from '../utils/statusBarManager';
export declare class CommandManager {
    private swarmManager;
    private diagnosticsProvider;
    private statusBarManager;
    constructor(swarmManager: SwarmManager, diagnosticsProvider: DiagnosticsProvider, statusBarManager: StatusBarManager);
    initializeSwarm(): Promise<void>;
    spawnCodingAgent(): Promise<void>;
    analyzeCurrentFile(): Promise<void>;
    generateTests(): Promise<void>;
    codeReview(): Promise<void>;
    optimizePerformance(): Promise<void>;
    securityAnalysis(): Promise<void>;
    explainCode(): Promise<void>;
    refactorCode(): Promise<void>;
    monitorSwarm(): Promise<void>;
    benchmarkPerformance(): Promise<void>;
    private getCommandContext;
    private createTestFile;
    private getTestFilePath;
    private showCodeReviewResults;
    private showOptimizationResults;
    private showCodeExplanation;
    private showRefactoringResults;
    private showBenchmarkResults;
}
//# sourceMappingURL=commandManager.d.ts.map