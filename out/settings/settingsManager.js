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
exports.SettingsManager = void 0;
const vscode = __importStar(require("vscode"));
class SettingsManager {
    constructor(context, profileManager, validationEngine, errorHandler) {
        this.settingsGroups = new Map();
        this.changeListeners = new Set();
        this.eventEmitter = new vscode.EventEmitter();
        this.onSettingsChange = this.eventEmitter.event;
        this.context = context;
        this.profileManager = profileManager;
        this.validationEngine = validationEngine;
        this.errorHandler = errorHandler;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Settings');
        this.initializeSettingsGroups();
        this.setupConfigurationListener();
    }
    async initialize() {
        try {
            this.outputChannel.appendLine('⚙️ Initializing Settings Manager...');
            // Initialize validation engine
            await this.validationEngine.initialize();
            // Load settings schema
            await this.loadSettingsSchema();
            // Validate current settings
            await this.validateAllSettings();
            this.outputChannel.appendLine('✅ Settings Manager initialized successfully');
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'SETTINGS_INIT',
                    component: 'SettingsManager'
                }, { severity: 'high' });
            }
        }
    }
    async showSettingsUI() {
        try {
            const panel = vscode.window.createWebviewPanel('ruvSwarmSettings', 'RUV-Swarm Settings', vscode.ViewColumn.Two, {
                enableScripts: true,
                localResourceRoots: [this.context.extensionUri],
                retainContextWhenHidden: true
            });
            panel.webview.html = await this.generateSettingsHTML(panel.webview);
            // Handle messages from webview
            panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message);
            });
            this.outputChannel.appendLine('🎛️ Settings UI opened');
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'SHOW_SETTINGS_UI',
                    component: 'SettingsManager'
                }, { severity: 'medium' });
            }
        }
    }
    async getSetting(key, defaultValue) {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        return config.get(key, defaultValue);
    }
    async setSetting(key, value, target) {
        try {
            // Validate the setting
            const validationResult = await this.validationEngine.validateSetting(key, value);
            if (!validationResult.isValid) {
                throw new Error(`Invalid setting value for ${key}: ${validationResult.errors.join(', ')}`);
            }
            const oldValue = await this.getSetting(key);
            const config = vscode.workspace.getConfiguration('ruv-swarm');
            await config.update(key, value, target || vscode.ConfigurationTarget.Workspace);
            // Emit change event
            const changeEvent = {
                key,
                oldValue,
                newValue: value,
                source: 'user',
                timestamp: new Date()
            };
            this.eventEmitter.fire(changeEvent);
            this.outputChannel.appendLine(`⚙️ Setting updated: ${key} = ${JSON.stringify(value)}`);
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'SET_SETTING',
                    component: 'SettingsManager',
                    additionalData: { key, value }
                }, { severity: 'medium' });
            }
            throw error;
        }
    }
    async resetSetting(key) {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        this.outputChannel.appendLine(`🔄 Setting reset: ${key}`);
    }
    async resetAllSettings() {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        const allKeys = this.getAllSettingKeys();
        for (const key of allKeys) {
            await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        }
        this.outputChannel.appendLine('🔄 All settings reset to defaults');
    }
    async exportSettings() {
        const settings = {};
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        for (const key of this.getAllSettingKeys()) {
            const value = config.get(key);
            if (value !== undefined) {
                settings[key] = value;
            }
        }
        return JSON.stringify({
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings
        }, null, 2);
    }
    async importSettings(settingsJson) {
        try {
            const imported = JSON.parse(settingsJson);
            if (!imported.settings) {
                throw new Error('Invalid settings format');
            }
            const config = vscode.workspace.getConfiguration('ruv-swarm');
            for (const [key, value] of Object.entries(imported.settings)) {
                // Validate before importing
                const validationResult = await this.validationEngine.validateSetting(key, value);
                if (validationResult.isValid) {
                    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
                }
                else {
                    this.outputChannel.appendLine(`⚠️ Skipped invalid setting: ${key}`);
                }
            }
            this.outputChannel.appendLine('📥 Settings imported successfully');
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'IMPORT_SETTINGS',
                    component: 'SettingsManager'
                }, { severity: 'medium' });
            }
            throw error;
        }
    }
    getSettingsGroups() {
        return Array.from(this.settingsGroups.values())
            .sort((a, b) => a.order - b.order);
    }
    getSettingsGroup(groupId) {
        return this.settingsGroups.get(groupId);
    }
    addSettingsGroup(group) {
        this.settingsGroups.set(group.id, group);
        this.outputChannel.appendLine(`📋 Added settings group: ${group.title}`);
    }
    removeSettingsGroup(groupId) {
        const removed = this.settingsGroups.delete(groupId);
        if (removed) {
            this.outputChannel.appendLine(`🗑️ Removed settings group: ${groupId}`);
        }
        return removed;
    }
    async validateAllSettings() {
        const errors = {};
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        for (const key of this.getAllSettingKeys()) {
            const value = config.get(key);
            if (value !== undefined) {
                const validationResult = await this.validationEngine.validateSetting(key, value);
                if (!validationResult.isValid) {
                    errors[key] = validationResult.errors;
                }
            }
        }
        if (Object.keys(errors).length > 0) {
            this.outputChannel.appendLine(`⚠️ Found ${Object.keys(errors).length} invalid settings`);
        }
        return errors;
    }
    async optimizeSettings() {
        try {
            this.outputChannel.appendLine('🔧 Optimizing settings for performance...');
            // Get current system capabilities
            const systemInfo = await this.getSystemInfo();
            // Optimize based on system capabilities
            const optimizations = this.calculateOptimalSettings(systemInfo);
            for (const [key, value] of Object.entries(optimizations)) {
                await this.setSetting(key, value);
            }
            this.outputChannel.appendLine('✅ Settings optimized successfully');
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'OPTIMIZE_SETTINGS',
                    component: 'SettingsManager'
                }, { severity: 'medium' });
            }
        }
    }
    async handleWebviewMessage(message) {
        try {
            switch (message.type) {
                case 'getSetting':
                    const value = await this.getSetting(message.key);
                    // Send response back to webview
                    break;
                case 'setSetting':
                    await this.setSetting(message.key, message.value);
                    break;
                case 'resetSetting':
                    await this.resetSetting(message.key);
                    break;
                case 'exportSettings':
                    const exported = await this.exportSettings();
                    // Trigger download in webview
                    break;
                case 'importSettings':
                    await this.importSettings(message.data);
                    break;
                case 'validateSettings':
                    const errors = await this.validateAllSettings();
                    // Send validation results to webview
                    break;
                case 'optimizeSettings':
                    await this.optimizeSettings();
                    break;
                default:
                    this.outputChannel.appendLine(`Unknown message type: ${message.type}`);
            }
        }
        catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'HANDLE_WEBVIEW_MESSAGE',
                    component: 'SettingsManager',
                    additionalData: { messageType: message.type }
                }, { severity: 'low' });
            }
        }
    }
    async generateSettingsHTML(webview) {
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.js'));
        const settingsGroups = this.getSettingsGroups();
        const currentSettings = await this.getCurrentSettings();
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">
            <title>RUV-Swarm Settings</title>
            <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
            <div class="settings-container">
                <header class="settings-header">
                    <h1>⚙️ RUV-Swarm Settings</h1>
                    <div class="header-actions">
                        <button id="export-btn" class="btn btn-secondary">📤 Export</button>
                        <button id="import-btn" class="btn btn-secondary">📥 Import</button>
                        <button id="optimize-btn" class="btn btn-primary">🔧 Optimize</button>
                        <button id="reset-all-btn" class="btn btn-danger">🔄 Reset All</button>
                    </div>
                </header>
                
                <div class="settings-content">
                    <nav class="settings-nav">
                        <ul class="nav-list">
                            ${settingsGroups.map(group => `
                                <li class="nav-item">
                                    <a href="#${group.id}" class="nav-link" data-group="${group.id}">
                                        <span class="nav-icon">${group.icon}</span>
                                        <span class="nav-title">${group.title}</span>
                                    </a>
                                </li>
                            `).join('')}
                        </ul>
                    </nav>
                    
                    <main class="settings-main">
                        ${settingsGroups.map(group => this.renderSettingsGroup(group, currentSettings)).join('')}
                    </main>
                </div>
            </div>
            
            <input type="file" id="import-file" accept=".json" style="display: none;">
            
            <script>
                const vscode = acquireVsCodeApi();
                
                // Initialize settings UI
                initializeSettingsUI();
                
                function initializeSettingsUI() {
                    // Setup navigation
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            const groupId = e.currentTarget.dataset.group;
                            showSettingsGroup(groupId);
                        });
                    });
                    
                    // Setup action buttons
                    document.getElementById('export-btn').addEventListener('click', exportSettings);
                    document.getElementById('import-btn').addEventListener('click', importSettings);
                    document.getElementById('optimize-btn').addEventListener('click', optimizeSettings);
                    document.getElementById('reset-all-btn').addEventListener('click', resetAllSettings);
                    
                    // Setup setting controls
                    document.querySelectorAll('.setting-control').forEach(control => {
                        control.addEventListener('change', handleSettingChange);
                    });
                    
                    // Show first group by default
                    if (document.querySelector('.nav-link')) {
                        const firstGroup = document.querySelector('.nav-link').dataset.group;
                        showSettingsGroup(firstGroup);
                    }
                }
                
                function showSettingsGroup(groupId) {
                    // Hide all groups
                    document.querySelectorAll('.settings-group').forEach(group => {
                        group.style.display = 'none';
                    });
                    
                    // Show selected group
                    const selectedGroup = document.getElementById(groupId);
                    if (selectedGroup) {
                        selectedGroup.style.display = 'block';
                    }
                    
                    // Update navigation
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.classList.remove('active');
                    });
                    document.querySelector(\`[data-group="\${groupId}"]\`).classList.add('active');
                }
                
                function handleSettingChange(event) {
                    const key = event.target.dataset.key;
                    let value = event.target.value;
                    
                    // Convert value based on type
                    const type = event.target.dataset.type;
                    switch (type) {
                        case 'boolean':
                            value = event.target.checked;
                            break;
                        case 'number':
                            value = parseFloat(value);
                            break;
                        case 'array':
                            value = value.split(',').map(s => s.trim()).filter(s => s);
                            break;
                    }
                    
                    vscode.postMessage({
                        type: 'setSetting',
                        key: key,
                        value: value
                    });
                }
                
                function exportSettings() {
                    vscode.postMessage({ type: 'exportSettings' });
                }
                
                function importSettings() {
                    document.getElementById('import-file').click();
                }
                
                function optimizeSettings() {
                    vscode.postMessage({ type: 'optimizeSettings' });
                }
                
                function resetAllSettings() {
                    if (confirm('Are you sure you want to reset all settings to defaults?')) {
                        vscode.postMessage({ type: 'resetAllSettings' });
                    }
                }
                
                // Handle file import
                document.getElementById('import-file').addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            vscode.postMessage({
                                type: 'importSettings',
                                data: e.target.result
                            });
                        };
                        reader.readAsText(file);
                    }
                });
            </script>
            <script src="${scriptUri}"></script>
        </body>
        </html>
        `;
    }
    renderSettingsGroup(group, currentSettings) {
        return `
        <div id="${group.id}" class="settings-group" style="display: none;">
            <div class="group-header">
                <h2>${group.icon} ${group.title}</h2>
                <p class="group-description">${group.description}</p>
            </div>
            
            <div class="settings-list">
                ${Object.entries(group.settings).map(([key, schema]) => this.renderSetting(key, schema, currentSettings[key])).join('')}
            </div>
        </div>
        `;
    }
    renderSetting(key, schema, currentValue) {
        const value = currentValue !== undefined ? currentValue : schema.default;
        let control = '';
        switch (schema.type) {
            case 'boolean':
                control = `<input type="checkbox" class="setting-control" data-key="${key}" data-type="boolean" ${value ? 'checked' : ''}>`;
                break;
            case 'number':
                control = `<input type="number" class="setting-control" data-key="${key}" data-type="number" value="${value}" ${schema.minimum !== undefined ? `min="${schema.minimum}"` : ''} ${schema.maximum !== undefined ? `max="${schema.maximum}"` : ''}>`;
                break;
            case 'string':
                if (schema.enum) {
                    control = `
                    <select class="setting-control" data-key="${key}" data-type="string">
                        ${schema.enum.map((option) => `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                    `;
                }
                else {
                    control = `<input type="text" class="setting-control" data-key="${key}" data-type="string" value="${value}">`;
                }
                break;
            case 'array':
                control = `<input type="text" class="setting-control" data-key="${key}" data-type="array" value="${Array.isArray(value) ? value.join(', ') : value}" placeholder="Comma-separated values">`;
                break;
            default:
                control = `<input type="text" class="setting-control" data-key="${key}" data-type="string" value="${JSON.stringify(value)}">`;
        }
        return `
        <div class="setting-item">
            <div class="setting-info">
                <label class="setting-label" for="${key}">${key}</label>
                <p class="setting-description">${schema.description}</p>
            </div>
            <div class="setting-control-wrapper">
                ${control}
                <button class="reset-btn" onclick="resetSetting('${key}')" title="Reset to default">🔄</button>
            </div>
        </div>
        `;
    }
    async getCurrentSettings() {
        const settings = {};
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        for (const key of this.getAllSettingKeys()) {
            settings[key] = config.get(key);
        }
        return settings;
    }
    getAllSettingKeys() {
        const keys = [];
        for (const group of this.settingsGroups.values()) {
            keys.push(...Object.keys(group.settings));
        }
        return keys;
    }
    async getSystemInfo() {
        // This would collect system information for optimization
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            cpuCount: require('os').cpus().length
        };
    }
    calculateOptimalSettings(systemInfo) {
        const optimizations = {};
        // Optimize based on CPU count
        if (systemInfo.cpuCount >= 8) {
            optimizations['maxAgents'] = 8;
            optimizations['fileWatcher.maxConcurrentAnalysis'] = 4;
        }
        else if (systemInfo.cpuCount >= 4) {
            optimizations['maxAgents'] = 4;
            optimizations['fileWatcher.maxConcurrentAnalysis'] = 2;
        }
        else {
            optimizations['maxAgents'] = 2;
            optimizations['fileWatcher.maxConcurrentAnalysis'] = 1;
        }
        // Optimize based on memory
        const memoryMB = systemInfo.memory.heapTotal / 1024 / 1024;
        if (memoryMB < 512) {
            optimizations['autoAnalyze.enabled'] = false;
            optimizations['fileWatcher.realTimeAnalysis'] = false;
        }
        return optimizations;
    }
    initializeSettingsGroups() {
        // Core settings group
        this.addSettingsGroup({
            id: 'core',
            title: 'Core Settings',
            description: 'Basic RUV-Swarm configuration',
            icon: '⚙️',
            order: 1,
            settings: {
                'enabled': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable RUV-Swarm AI assistance'
                },
                'autoInitialize': {
                    type: 'boolean',
                    default: true,
                    description: 'Automatically initialize swarm on workspace open'
                },
                'defaultTopology': {
                    type: 'string',
                    default: 'hierarchical',
                    enum: ['hierarchical', 'mesh', 'ring', 'star'],
                    description: 'Default swarm topology'
                },
                'maxAgents': {
                    type: 'number',
                    default: 8,
                    minimum: 1,
                    maximum: 32,
                    description: 'Maximum number of agents in swarm'
                }
            }
        });
        // File Watcher settings group
        this.addSettingsGroup({
            id: 'fileWatcher',
            title: 'File Watcher',
            description: 'File monitoring and analysis settings',
            icon: '👁️',
            order: 2,
            settings: {
                'fileWatcher.enabled': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable file watching'
                },
                'fileWatcher.realTimeAnalysis': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable real-time analysis'
                },
                'fileWatcher.maxConcurrentAnalysis': {
                    type: 'number',
                    default: 3,
                    minimum: 1,
                    maximum: 10,
                    description: 'Maximum concurrent file analyses'
                },
                'fileWatcher.analysisDelay': {
                    type: 'number',
                    default: 2000,
                    minimum: 100,
                    maximum: 10000,
                    description: 'Delay before analysis (ms)'
                }
            }
        });
        // Diagnostics settings group
        this.addSettingsGroup({
            id: 'diagnostics',
            title: 'Diagnostics',
            description: 'Code analysis and diagnostics settings',
            icon: '🔍',
            order: 3,
            settings: {
                'diagnostics.enabled': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable advanced diagnostics'
                },
                'diagnostics.aiAnalysis': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable AI-powered analysis'
                },
                'diagnostics.securityAnalysis': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable security analysis'
                },
                'diagnostics.performanceAnalysis': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable performance analysis'
                }
            }
        });
    }
    async loadSettingsSchema() {
        // Load additional settings schema from configuration files
        // This could be extended to load from external schema files
    }
    setupConfigurationListener() {
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('ruv-swarm')) {
                // Handle configuration changes
                this.outputChannel.appendLine('🔄 Configuration changed');
            }
        });
    }
    dispose() {
        this.eventEmitter.dispose();
        this.outputChannel.dispose();
        this.changeListeners.clear();
        this.settingsGroups.clear();
    }
}
exports.SettingsManager = SettingsManager;
//# sourceMappingURL=settingsManager.js.map