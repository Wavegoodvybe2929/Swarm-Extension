import * as vscode from 'vscode';
export interface CLIValidationResult {
    isAvailable: boolean;
    version?: string;
    capabilities: string[];
    errors: string[];
    warnings: string[];
    recommendations: string[];
}
export interface CLICommand {
    command: string;
    args: string[];
    timeout: number;
    retries: number;
    validateOutput?: (output: string) => boolean;
    parseOutput?: (output: string) => any;
}
export declare class CLIValidator implements vscode.Disposable {
    private outputChannel;
    private validationCache;
    private cacheExpiry;
    constructor();
    validateCLI(): Promise<CLIValidationResult>;
    executeCommand(cliCommand: CLICommand): Promise<{
        success: boolean;
        stdout: string;
        stderr: string;
        parsedOutput?: any;
        duration: number;
    }>;
    validateWorkspace(): Promise<{
        isValid: boolean;
        issues: string[];
        suggestions: string[];
    }>;
    private executeWithRetry;
    private checkCapabilities;
    private validateEnvironment;
    private checkDependencies;
    private parseVersion;
    private generateRecommendations;
    private isCacheValid;
    private setCacheTimestamp;
    private getCacheTimestamp;
    clearCache(): void;
    dispose(): void;
}
//# sourceMappingURL=cliValidator.d.ts.map