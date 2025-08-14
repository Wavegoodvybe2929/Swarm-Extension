import * as vscode from 'vscode';
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}
export interface ValidationRule {
    id: string;
    name: string;
    description: string;
    settingKey: string;
    validator: (value: any) => ValidationResult;
    priority: number;
}
export declare class ValidationEngine implements vscode.Disposable {
    private rules;
    private readonly outputChannel;
    constructor();
    initialize(): Promise<void>;
    validateSetting(key: string, value: any): Promise<ValidationResult>;
    validateAllSettings(settings: {
        [key: string]: any;
    }): Promise<{
        [key: string]: ValidationResult;
    }>;
    addValidationRule(rule: ValidationRule): void;
    removeValidationRule(settingKey: string, ruleId: string): boolean;
    getValidationRules(settingKey?: string): ValidationRule[];
    private initializeDefaultRules;
    private isValidGlobPattern;
    dispose(): void;
}
//# sourceMappingURL=validationEngine.d.ts.map