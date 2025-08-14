import * as vscode from 'vscode';

export interface SettingsProfile {
    id: string;
    name: string;
    description: string;
    settings: { [key: string]: any };
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
}

export class ProfileManager implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private profiles: Map<string, SettingsProfile> = new Map();
    private activeProfileId?: string;
    private readonly outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Profile Manager');
    }

    async initialize(): Promise<void> {
        try {
            this.outputChannel.appendLine('👤 Initializing Profile Manager...');
            
            // Load saved profiles
            await this.loadProfiles();
            
            // Create default profile if none exist
            if (this.profiles.size === 0) {
                await this.createDefaultProfile();
            }
            
            this.outputChannel.appendLine('✅ Profile Manager initialized successfully');
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize Profile Manager: ${errorMessage}`);
            throw error;
        }
    }

    async createProfile(name: string, description: string, settings: { [key: string]: any }): Promise<SettingsProfile> {
        const profile: SettingsProfile = {
            id: this.generateProfileId(),
            name,
            description,
            settings: { ...settings },
            isDefault: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: []
        };

        this.profiles.set(profile.id, profile);
        await this.saveProfiles();
        
        this.outputChannel.appendLine(`👤 Created profile: ${name}`);
        return profile;
    }

    async updateProfile(profileId: string, updates: Partial<SettingsProfile>): Promise<boolean> {
        const profile = this.profiles.get(profileId);
        if (!profile) {
            return false;
        }

        Object.assign(profile, updates, { updatedAt: new Date() });
        await this.saveProfiles();
        
        this.outputChannel.appendLine(`👤 Updated profile: ${profile.name}`);
        return true;
    }

    async deleteProfile(profileId: string): Promise<boolean> {
        const profile = this.profiles.get(profileId);
        if (!profile || profile.isDefault) {
            return false;
        }

        this.profiles.delete(profileId);
        
        // If this was the active profile, switch to default
        if (this.activeProfileId === profileId) {
            const defaultProfile = this.getDefaultProfile();
            if (defaultProfile) {
                this.activeProfileId = defaultProfile.id;
            }
        }
        
        await this.saveProfiles();
        this.outputChannel.appendLine(`👤 Deleted profile: ${profile.name}`);
        return true;
    }

    async activateProfile(profileId: string): Promise<boolean> {
        const profile = this.profiles.get(profileId);
        if (!profile) {
            return false;
        }

        this.activeProfileId = profileId;
        await this.applyProfileSettings(profile);
        await this.saveActiveProfile();
        
        this.outputChannel.appendLine(`👤 Activated profile: ${profile.name}`);
        return true;
    }

    getProfile(profileId: string): SettingsProfile | undefined {
        return this.profiles.get(profileId);
    }

    getProfiles(): SettingsProfile[] {
        return Array.from(this.profiles.values());
    }

    getActiveProfile(): SettingsProfile | undefined {
        return this.activeProfileId ? this.profiles.get(this.activeProfileId) : undefined;
    }

    getDefaultProfile(): SettingsProfile | undefined {
        return Array.from(this.profiles.values()).find(p => p.isDefault);
    }

    async exportProfile(profileId: string): Promise<string> {
        const profile = this.profiles.get(profileId);
        if (!profile) {
            throw new Error(`Profile ${profileId} not found`);
        }

        return JSON.stringify({
            version: '1.0',
            exportedAt: new Date().toISOString(),
            profile: {
                ...profile,
                id: undefined // Remove ID for export
            }
        }, null, 2);
    }

    async importProfile(profileData: string): Promise<SettingsProfile> {
        try {
            const imported = JSON.parse(profileData);
            
            if (!imported.profile) {
                throw new Error('Invalid profile format');
            }

            const profile = imported.profile;
            const newProfile = await this.createProfile(
                profile.name + ' (Imported)',
                profile.description || 'Imported profile',
                profile.settings || {}
            );

            if (profile.tags) {
                newProfile.tags = profile.tags;
            }

            await this.saveProfiles();
            this.outputChannel.appendLine(`👤 Imported profile: ${newProfile.name}`);
            
            return newProfile;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to import profile: ${errorMessage}`);
            throw error;
        }
    }

    private async createDefaultProfile(): Promise<void> {
        const defaultSettings = await this.getCurrentSettings();
        
        const defaultProfile: SettingsProfile = {
            id: 'default',
            name: 'Default',
            description: 'Default RUV-Swarm settings',
            settings: defaultSettings,
            isDefault: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: ['default']
        };

        this.profiles.set(defaultProfile.id, defaultProfile);
        this.activeProfileId = defaultProfile.id;
        
        await this.saveProfiles();
        this.outputChannel.appendLine('👤 Created default profile');
    }

    private async getCurrentSettings(): Promise<{ [key: string]: any }> {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        const settings: { [key: string]: any } = {};
        
        // Get all current settings
        const inspect = config.inspect('');
        if (inspect) {
            // This is a simplified approach - in reality, you'd want to iterate through all known settings
            settings['enabled'] = config.get('enabled');
            settings['autoInitialize'] = config.get('autoInitialize');
            settings['defaultTopology'] = config.get('defaultTopology');
            settings['maxAgents'] = config.get('maxAgents');
        }
        
        return settings;
    }

    private async applyProfileSettings(profile: SettingsProfile): Promise<void> {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        
        for (const [key, value] of Object.entries(profile.settings)) {
            try {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            } catch (error) {
                this.outputChannel.appendLine(`⚠️ Failed to apply setting ${key}: ${error}`);
            }
        }
    }

    private async loadProfiles(): Promise<void> {
        try {
            const savedProfiles = this.context.globalState.get<SettingsProfile[]>('settingsProfiles', []);
            const activeProfileId = this.context.globalState.get<string>('activeProfileId');
            
            for (const profile of savedProfiles) {
                this.profiles.set(profile.id, profile);
            }
            
            this.activeProfileId = activeProfileId;
            this.outputChannel.appendLine(`👤 Loaded ${savedProfiles.length} profiles`);
            
        } catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to load profiles, starting fresh');
        }
    }

    private async saveProfiles(): Promise<void> {
        try {
            const profiles = Array.from(this.profiles.values());
            await this.context.globalState.update('settingsProfiles', profiles);
            
        } catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to save profiles');
        }
    }

    private async saveActiveProfile(): Promise<void> {
        try {
            await this.context.globalState.update('activeProfileId', this.activeProfileId);
            
        } catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to save active profile');
        }
    }

    private generateProfileId(): string {
        return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.profiles.clear();
    }
}
