import * as vscode from 'vscode';
export interface SettingsProfile {
    id: string;
    name: string;
    description: string;
    settings: {
        [key: string]: any;
    };
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
}
export declare class ProfileManager implements vscode.Disposable {
    private context;
    private profiles;
    private activeProfileId?;
    private readonly outputChannel;
    constructor(context: vscode.ExtensionContext);
    initialize(): Promise<void>;
    createProfile(name: string, description: string, settings: {
        [key: string]: any;
    }): Promise<SettingsProfile>;
    updateProfile(profileId: string, updates: Partial<SettingsProfile>): Promise<boolean>;
    deleteProfile(profileId: string): Promise<boolean>;
    activateProfile(profileId: string): Promise<boolean>;
    getProfile(profileId: string): SettingsProfile | undefined;
    getProfiles(): SettingsProfile[];
    getActiveProfile(): SettingsProfile | undefined;
    getDefaultProfile(): SettingsProfile | undefined;
    exportProfile(profileId: string): Promise<string>;
    importProfile(profileData: string): Promise<SettingsProfile>;
    private createDefaultProfile;
    private getCurrentSettings;
    private applyProfileSettings;
    private loadProfiles;
    private saveProfiles;
    private saveActiveProfile;
    private generateProfileId;
    dispose(): void;
}
//# sourceMappingURL=profileManager.d.ts.map