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

export class ValidationEngine implements vscode.Disposable {
    private rules: Map<string, ValidationRule[]> = new Map();
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Validation');
    }

    async initialize(): Promise<void> {
        try {
            this.outputChannel.appendLine('✅ Initializing Validation Engine...');
            
            // Initialize default validation rules
            this.initializeDefaultRules();
            
            this.outputChannel.appendLine('✅ Validation Engine initialized successfully');
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize Validation Engine: ${errorMessage}`);
            throw error;
        }
    }

    async validateSetting(key: string, value: any): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        const rules = this.rules.get(key) || [];
        
        for (const rule of rules.sort((a, b) => b.priority - a.priority)) {
            try {
                const ruleResult = rule.validator(value);
                
                if (!ruleResult.isValid) {
                    result.isValid = false;
                }
                
                result.errors.push(...ruleResult.errors);
                result.warnings.push(...ruleResult.warnings);
                
            } catch (error) {
                this.outputChannel.appendLine(`⚠️ Error in validation rule ${rule.id}: ${error}`);
                result.warnings.push(`Validation rule ${rule.name} failed to execute`);
            }
        }

        return result;
    }

    async validateAllSettings(settings: { [key: string]: any }): Promise<{ [key: string]: ValidationResult }> {
        const results: { [key: string]: ValidationResult } = {};
        
        for (const [key, value] of Object.entries(settings)) {
            results[key] = await this.validateSetting(key, value);
        }
        
        return results;
    }

    addValidationRule(rule: ValidationRule): void {
        if (!this.rules.has(rule.settingKey)) {
            this.rules.set(rule.settingKey, []);
        }
        
        this.rules.get(rule.settingKey)!.push(rule);
        this.outputChannel.appendLine(`📋 Added validation rule: ${rule.name} for ${rule.settingKey}`);
    }

    removeValidationRule(settingKey: string, ruleId: string): boolean {
        const rules = this.rules.get(settingKey);
        if (!rules) {
            return false;
        }

        const index = rules.findIndex(rule => rule.id === ruleId);
        if (index === -1) {
            return false;
        }

        rules.splice(index, 1);
        
        if (rules.length === 0) {
            this.rules.delete(settingKey);
        }
        
        this.outputChannel.appendLine(`🗑️ Removed validation rule: ${ruleId} from ${settingKey}`);
        return true;
    }

    getValidationRules(settingKey?: string): ValidationRule[] {
        if (settingKey) {
            return this.rules.get(settingKey) || [];
        }
        
        const allRules: ValidationRule[] = [];
        for (const rules of this.rules.values()) {
            allRules.push(...rules);
        }
        
        return allRules;
    }

    private initializeDefaultRules(): void {
        // Core settings validation
        this.addValidationRule({
            id: 'enabled-boolean',
            name: 'Enabled Boolean Check',
            description: 'Ensures enabled setting is a boolean',
            settingKey: 'enabled',
            priority: 10,
            validator: (value: any): ValidationResult => {
                if (typeof value !== 'boolean') {
                    return {
                        isValid: false,
                        errors: ['enabled must be a boolean value'],
                        warnings: []
                    };
                }
                return { isValid: true, errors: [], warnings: [] };
            }
        });

        this.addValidationRule({
            id: 'maxAgents-range',
            name: 'Max Agents Range Check',
            description: 'Ensures maxAgents is within valid range',
            settingKey: 'maxAgents',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
                
                if (typeof value !== 'number') {
                    result.isValid = false;
                    result.errors.push('maxAgents must be a number');
                    return result;
                }
                
                if (value < 1) {
                    result.isValid = false;
                    result.errors.push('maxAgents must be at least 1');
                }
                
                if (value > 32) {
                    result.isValid = false;
                    result.errors.push('maxAgents cannot exceed 32');
                }
                
                if (value > 16) {
                    result.warnings.push('High agent count may impact performance');
                }
                
                return result;
            }
        });

        this.addValidationRule({
            id: 'defaultTopology-enum',
            name: 'Default Topology Enum Check',
            description: 'Ensures defaultTopology is a valid option',
            settingKey: 'defaultTopology',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const validTopologies = ['hierarchical', 'mesh', 'ring', 'star'];
                
                if (typeof value !== 'string') {
                    return {
                        isValid: false,
                        errors: ['defaultTopology must be a string'],
                        warnings: []
                    };
                }
                
                if (!validTopologies.includes(value)) {
                    return {
                        isValid: false,
                        errors: [`defaultTopology must be one of: ${validTopologies.join(', ')}`],
                        warnings: []
                    };
                }
                
                return { isValid: true, errors: [], warnings: [] };
            }
        });

        // File watcher validation
        this.addValidationRule({
            id: 'fileWatcher-enabled-boolean',
            name: 'File Watcher Enabled Boolean Check',
            description: 'Ensures fileWatcher.enabled is a boolean',
            settingKey: 'fileWatcher.enabled',
            priority: 10,
            validator: (value: any): ValidationResult => {
                if (typeof value !== 'boolean') {
                    return {
                        isValid: false,
                        errors: ['fileWatcher.enabled must be a boolean value'],
                        warnings: []
                    };
                }
                return { isValid: true, errors: [], warnings: [] };
            }
        });

        this.addValidationRule({
            id: 'fileWatcher-maxConcurrentAnalysis-range',
            name: 'Max Concurrent Analysis Range Check',
            description: 'Ensures maxConcurrentAnalysis is within valid range',
            settingKey: 'fileWatcher.maxConcurrentAnalysis',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
                
                if (typeof value !== 'number') {
                    result.isValid = false;
                    result.errors.push('fileWatcher.maxConcurrentAnalysis must be a number');
                    return result;
                }
                
                if (value < 1) {
                    result.isValid = false;
                    result.errors.push('fileWatcher.maxConcurrentAnalysis must be at least 1');
                }
                
                if (value > 10) {
                    result.isValid = false;
                    result.errors.push('fileWatcher.maxConcurrentAnalysis cannot exceed 10');
                }
                
                if (value > 5) {
                    result.warnings.push('High concurrent analysis count may impact performance');
                }
                
                return result;
            }
        });

        this.addValidationRule({
            id: 'fileWatcher-analysisDelay-range',
            name: 'Analysis Delay Range Check',
            description: 'Ensures analysisDelay is within valid range',
            settingKey: 'fileWatcher.analysisDelay',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
                
                if (typeof value !== 'number') {
                    result.isValid = false;
                    result.errors.push('fileWatcher.analysisDelay must be a number');
                    return result;
                }
                
                if (value < 100) {
                    result.isValid = false;
                    result.errors.push('fileWatcher.analysisDelay must be at least 100ms');
                }
                
                if (value > 30000) {
                    result.isValid = false;
                    result.errors.push('fileWatcher.analysisDelay cannot exceed 30000ms');
                }
                
                if (value < 500) {
                    result.warnings.push('Very short analysis delay may cause excessive CPU usage');
                }
                
                return result;
            }
        });

        // File watcher patterns validation
        this.addValidationRule({
            id: 'fileWatcher-patterns-array',
            name: 'File Watcher Patterns Array Check',
            description: 'Ensures fileWatcher.patterns is a valid array',
            settingKey: 'fileWatcher.patterns',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
                
                if (!Array.isArray(value)) {
                    result.isValid = false;
                    result.errors.push('fileWatcher.patterns must be an array');
                    return result;
                }
                
                if (value.length === 0) {
                    result.warnings.push('Empty patterns array will not watch any files');
                    return result;
                }
                
                for (let i = 0; i < value.length; i++) {
                    const pattern = value[i];
                    if (typeof pattern !== 'string') {
                        result.isValid = false;
                        result.errors.push(`Pattern at index ${i} must be a string`);
                        continue;
                    }
                    
                    // Basic glob pattern validation
                    if (!this.isValidGlobPattern(pattern)) {
                        result.warnings.push(`Pattern "${pattern}" may not be a valid glob pattern`);
                    }
                }
                
                if (value.length > 20) {
                    result.warnings.push('Large number of patterns may impact performance');
                }
                
                return result;
            }
        });

        // Cognitive patterns validation
        this.addValidationRule({
            id: 'cognitivePatterns-array',
            name: 'Cognitive Patterns Array Check',
            description: 'Ensures cognitivePatterns is a valid array',
            settingKey: 'cognitivePatterns',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
                const validPatterns = ['convergent', 'divergent', 'systems', 'critical', 'lateral', 'abstract', 'hybrid'];
                
                if (!Array.isArray(value)) {
                    result.isValid = false;
                    result.errors.push('cognitivePatterns must be an array');
                    return result;
                }
                
                if (value.length === 0) {
                    result.warnings.push('Empty cognitive patterns array may limit AI capabilities');
                    return result;
                }
                
                for (let i = 0; i < value.length; i++) {
                    const pattern = value[i];
                    if (typeof pattern !== 'string') {
                        result.isValid = false;
                        result.errors.push(`Cognitive pattern at index ${i} must be a string`);
                        continue;
                    }
                    
                    if (!validPatterns.includes(pattern)) {
                        result.isValid = false;
                        result.errors.push(`"${pattern}" is not a valid cognitive pattern. Valid patterns: ${validPatterns.join(', ')}`);
                    }
                }
                
                // Check for duplicates
                const uniquePatterns = [...new Set(value)];
                if (uniquePatterns.length !== value.length) {
                    result.warnings.push('Duplicate cognitive patterns detected');
                }
                
                return result;
            }
        });

        // Auto-analyze settings validation
        this.addValidationRule({
            id: 'autoAnalyze-debounceMs-range',
            name: 'Auto Analyze Debounce Range Check',
            description: 'Ensures autoAnalyze.debounceMs is within valid range',
            settingKey: 'autoAnalyze.debounceMs',
            priority: 10,
            validator: (value: any): ValidationResult => {
                const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
                
                if (typeof value !== 'number') {
                    result.isValid = false;
                    result.errors.push('autoAnalyze.debounceMs must be a number');
                    return result;
                }
                
                if (value < 100) {
                    result.isValid = false;
                    result.errors.push('autoAnalyze.debounceMs must be at least 100ms');
                }
                
                if (value > 10000) {
                    result.isValid = false;
                    result.errors.push('autoAnalyze.debounceMs cannot exceed 10000ms');
                }
                
                if (value < 500) {
                    result.warnings.push('Very short debounce may cause excessive analysis');
                }
                
                return result;
            }
        });

        this.outputChannel.appendLine(`📋 Initialized ${this.getValidationRules().length} default validation rules`);
    }

    private isValidGlobPattern(pattern: string): boolean {
        try {
            // Basic glob pattern validation
            // Check for common glob patterns and invalid characters
            const invalidChars = /[<>:"|?]/;
            if (invalidChars.test(pattern)) {
                return false;
            }
            
            // Check for balanced brackets
            let bracketCount = 0;
            for (const char of pattern) {
                if (char === '[') {bracketCount++;}
                if (char === ']') {bracketCount--;}
                if (bracketCount < 0) {return false;}
            }
            
            return bracketCount === 0;
        } catch {
            return false;
        }
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.rules.clear();
    }
}
