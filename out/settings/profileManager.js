"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileManager = void 0;
const vscode = __importStar(require("vscode"));
class ProfileManager {
    constructor(context) {
        this.profiles = new Map();
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Profile Manager');
    }
    async initialize() {
        try {
            this.outputChannel.appendLine('👤 Initializing Profile Manager...');
            // Load saved profiles
            await this.loadProfiles();
            // Create default profile if none exist
            if (this.profiles.size === 0) {
                await this.createDefaultProfile();
            }
            this.outputChannel.appendLine('✅ Profile Manager initialized successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to initialize Profile Manager: ${errorMessage}`);
            throw error;
        }
    }
    async createProfile(name, description, settings) {
        const profile = {
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
    async updateProfile(profileId, updates) {
        const profile = this.profiles.get(profileId);
        if (!profile) {
            return false;
        }
        Object.assign(profile, updates, { updatedAt: new Date() });
        await this.saveProfiles();
        this.outputChannel.appendLine(`👤 Updated profile: ${profile.name}`);
        return true;
    }
    async deleteProfile(profileId) {
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
    async activateProfile(profileId) {
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
    getProfile(profileId) {
        return this.profiles.get(profileId);
    }
    getProfiles() {
        return Array.from(this.profiles.values());
    }
    getActiveProfile() {
        return this.activeProfileId ? this.profiles.get(this.activeProfileId) : undefined;
    }
    getDefaultProfile() {
        return Array.from(this.profiles.values()).find(p => p.isDefault);
    }
    async exportProfile(profileId) {
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
    async importProfile(profileData) {
        try {
            const imported = JSON.parse(profileData);
            if (!imported.profile) {
                throw new Error('Invalid profile format');
            }
            const profile = imported.profile;
            const newProfile = await this.createProfile(profile.name + ' (Imported)', profile.description || 'Imported profile', profile.settings || {});
            if (profile.tags) {
                newProfile.tags = profile.tags;
            }
            await this.saveProfiles();
            this.outputChannel.appendLine(`👤 Imported profile: ${newProfile.name}`);
            return newProfile;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.outputChannel.appendLine(`❌ Failed to import profile: ${errorMessage}`);
            throw error;
        }
    }
    async createDefaultProfile() {
        const defaultSettings = await this.getCurrentSettings();
        const defaultProfile = {
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
    async getCurrentSettings() {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        const settings = {};
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
    async applyProfileSettings(profile) {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        for (const [key, value] of Object.entries(profile.settings)) {
            try {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
            catch (error) {
                this.outputChannel.appendLine(`⚠️ Failed to apply setting ${key}: ${error}`);
            }
        }
    }
    async loadProfiles() {
        try {
            const savedProfiles = this.context.globalState.get('settingsProfiles', []);
            const activeProfileId = this.context.globalState.get('activeProfileId');
            for (const profile of savedProfiles) {
                this.profiles.set(profile.id, profile);
            }
            this.activeProfileId = activeProfileId;
            this.outputChannel.appendLine(`👤 Loaded ${savedProfiles.length} profiles`);
        }
        catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to load profiles, starting fresh');
        }
    }
    async saveProfiles() {
        try {
            const profiles = Array.from(this.profiles.values());
            await this.context.globalState.update('settingsProfiles', profiles);
        }
        catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to save profiles');
        }
    }
    async saveActiveProfile() {
        try {
            await this.context.globalState.update('activeProfileId', this.activeProfileId);
        }
        catch (error) {
            this.outputChannel.appendLine('⚠️ Failed to save active profile');
        }
    }
    generateProfileId() {
        return `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    dispose() {
        this.outputChannel.dispose();
        this.profiles.clear();
    }
}
exports.ProfileManager = ProfileManager;
//# sourceMappingURL=profileManager.js.map