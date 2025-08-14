import * as vscode from 'vscode';
import { ProfileManager } from './profileManager';
import { ValidationEngine } from './validationEngine';
import { ErrorHandler } from '../utils/errorHandler';
export interface SettingsSchema {
    [key: string]: {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object';
        default: any;
        description: string;
        enum?: any[];
        minimum?: number;
        maximum?: number;
        items?: SettingsSchema;
        properties?: SettingsSchema;
        required?: boolean;
        validation?: (value: any) => string | null;
    };
}
export interface SettingsGroup {
    id: string;
    title: string;
    description: string;
    icon: string;
    settings: SettingsSchema;
    order: number;
}
export interface SettingsChangeEvent {
    key: string;
    oldValue: any;
    newValue: any;
    source: 'user' | 'profile' | 'system';
    timestamp: Date;
}
export declare class SettingsManager implements vscode.Disposable {
    private context;
    private profileManager;
    private validationEngine;
    private errorHandler;
    private settingsGroups;
    private changeListeners;
    private readonly outputChannel;
    private readonly eventEmitter;
    readonly onSettingsChange: vscode.Event<SettingsChangeEvent>;
    constructor(context: vscode.ExtensionContext, profileManager: ProfileManager, validationEngine: ValidationEngine, errorHandler: ErrorHandler);
    initialize(): Promise<void>;
    showSettingsUI(): Promise<void>;
    getSetting<T>(key: string, defaultValue?: T): Promise<T>;
    setSetting(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void>;
    resetSetting(key: string): Promise<void>;
    resetAllSettings(): Promise<void>;
    exportSettings(): Promise<string>;
    importSettings(settingsJson: string): Promise<void>;
    getSettingsGroups(): SettingsGroup[];
    getSettingsGroup(groupId: string): SettingsGroup | undefined;
    addSettingsGroup(group: SettingsGroup): void;
    removeSettingsGroup(groupId: string): boolean;
    validateAllSettings(): Promise<{
        [key: string]: string[];
    }>;
    optimizeSettings(): Promise<void>;
    private handleWebviewMessage;
    private generateSettingsHTML;
    private renderSettingsGroup;
    private renderSetting;
    private getCurrentSettings;
    private getAllSettingKeys;
    private getSystemInfo;
    private calculateOptimalSettings;
    private initializeSettingsGroups;
    private loadSettingsSchema;
    private setupConfigurationListener;
    dispose(): void;
}
//# sourceMappingURL=settingsManager.d.ts.map