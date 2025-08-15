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

export class SettingsManager implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private profileManager: ProfileManager;
    private validationEngine: ValidationEngine;
    private errorHandler: ErrorHandler;
    
    private settingsGroups: Map<string, SettingsGroup> = new Map();
    private changeListeners: Set<(event: SettingsChangeEvent) => void> = new Set();
    private readonly outputChannel: vscode.OutputChannel;
    
    private readonly eventEmitter = new vscode.EventEmitter<SettingsChangeEvent>();
    public readonly onSettingsChange = this.eventEmitter.event;

    constructor(
        context: vscode.ExtensionContext,
        profileManager: ProfileManager,
        validationEngine: ValidationEngine,
        errorHandler: ErrorHandler
    ) {
        this.context = context;
        this.profileManager = profileManager;
        this.validationEngine = validationEngine;
        this.errorHandler = errorHandler;
        
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Settings');
        
        this.initializeSettingsGroups();
        this.setupConfigurationListener();
    }

    async initialize(): Promise<void> {
        try {
            this.outputChannel.appendLine('⚙️ Initializing Settings Manager...');
            
            // Initialize validation engine
            await this.validationEngine.initialize();
            
            // Load settings schema
            await this.loadSettingsSchema();
            
            // Validate current settings
            await this.validateAllSettings();
            
            this.outputChannel.appendLine('✅ Settings Manager initialized successfully');
            
        } catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'SETTINGS_INIT',
                    component: 'SettingsManager'
                }, { severity: 'high' });
            }
        }
    }

    async showSettingsUI(): Promise<void> {
        try {
            const panel = vscode.window.createWebviewPanel(
                'ruvSwarmSettings',
                'RUV-Swarm Settings',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    localResourceRoots: [this.context.extensionUri],
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = await this.generateSettingsHTML(panel.webview);
            
            // Handle messages from webview
            panel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message);
            });

            this.outputChannel.appendLine('🎛️ Settings UI opened');
            
        } catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'SHOW_SETTINGS_UI',
                    component: 'SettingsManager'
                }, { severity: 'medium' });
            }
        }
    }

    async getSetting<T>(key: string, defaultValue?: T): Promise<T> {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        return config.get<T>(key, defaultValue as T);
    }

    async setSetting(key: string, value: any, target?: vscode.ConfigurationTarget): Promise<void> {
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
            const changeEvent: SettingsChangeEvent = {
                key,
                oldValue,
                newValue: value,
                source: 'user',
                timestamp: new Date()
            };
            
            this.eventEmitter.fire(changeEvent);
            this.outputChannel.appendLine(`⚙️ Setting updated: ${key} = ${JSON.stringify(value)}`);
            
        } catch (error) {
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

    async resetSetting(key: string): Promise<void> {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        
        this.outputChannel.appendLine(`🔄 Setting reset: ${key}`);
    }

    async resetAllSettings(): Promise<void> {
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        const allKeys = this.getAllSettingKeys();
        
        for (const key of allKeys) {
            await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
        }
        
        this.outputChannel.appendLine('🔄 All settings reset to defaults');
    }

    async exportSettings(): Promise<string> {
        const settings: { [key: string]: any } = {};
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

    async importSettings(settingsJson: string): Promise<void> {
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
                } else {
                    this.outputChannel.appendLine(`⚠️ Skipped invalid setting: ${key}`);
                }
            }
            
            this.outputChannel.appendLine('📥 Settings imported successfully');
            
        } catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'IMPORT_SETTINGS',
                    component: 'SettingsManager'
                }, { severity: 'medium' });
            }
            throw error;
        }
    }

    getSettingsGroups(): SettingsGroup[] {
        return Array.from(this.settingsGroups.values())
            .sort((a, b) => a.order - b.order);
    }

    getSettingsGroup(groupId: string): SettingsGroup | undefined {
        return this.settingsGroups.get(groupId);
    }

    addSettingsGroup(group: SettingsGroup): void {
        this.settingsGroups.set(group.id, group);
        this.outputChannel.appendLine(`📋 Added settings group: ${group.title}`);
    }

    removeSettingsGroup(groupId: string): boolean {
        const removed = this.settingsGroups.delete(groupId);
        if (removed) {
            this.outputChannel.appendLine(`🗑️ Removed settings group: ${groupId}`);
        }
        return removed;
    }

    async validateAllSettings(): Promise<{ [key: string]: string[] }> {
        const errors: { [key: string]: string[] } = {};
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

    async optimizeSettings(): Promise<void> {
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
            
        } catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'OPTIMIZE_SETTINGS',
                    component: 'SettingsManager'
                }, { severity: 'medium' });
            }
        }
    }

    private async handleWebviewMessage(message: any): Promise<void> {
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
        } catch (error) {
            if (error instanceof Error) {
                await this.errorHandler.handleError(error, {
                    operation: 'HANDLE_WEBVIEW_MESSAGE',
                    component: 'SettingsManager',
                    additionalData: { messageType: message.type }
                }, { severity: 'low' });
            }
        }
    }

    private async generateSettingsHTML(webview: vscode.Webview): Promise<string> {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.css')
        );
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.context.extensionUri, 'media', 'settings.js')
        );

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

    private renderSettingsGroup(group: SettingsGroup, currentSettings: { [key: string]: any }): string {
        return `
        <div id="${group.id}" class="settings-group" style="display: none;">
            <div class="group-header">
                <h2>${group.icon} ${group.title}</h2>
                <p class="group-description">${group.description}</p>
            </div>
            
            <div class="settings-list">
                ${Object.entries(group.settings).map(([key, schema]) => 
                    this.renderSetting(key, schema, currentSettings[key])
                ).join('')}
            </div>
        </div>
        `;
    }

    private renderSetting(key: string, schema: any, currentValue: any): string {
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
                        ${schema.enum.map((option: any) => 
                            `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`
                        ).join('')}
                    </select>
                    `;
                } else {
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

    private async getCurrentSettings(): Promise<{ [key: string]: any }> {
        const settings: { [key: string]: any } = {};
        const config = vscode.workspace.getConfiguration('ruv-swarm');
        
        for (const key of this.getAllSettingKeys()) {
            settings[key] = config.get(key);
        }
        
        return settings;
    }

    private getAllSettingKeys(): string[] {
        const keys: string[] = [];
        
        for (const group of this.settingsGroups.values()) {
            keys.push(...Object.keys(group.settings));
        }
        
        return keys;
    }

    private async getSystemInfo(): Promise<any> {
        // This would collect system information for optimization
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memory: process.memoryUsage(),
            cpuCount: require('os').cpus().length
        };
    }

    private calculateOptimalSettings(systemInfo: any): { [key: string]: any } {
        const optimizations: { [key: string]: any } = {};
        
        // Optimize based on CPU count
        if (systemInfo.cpuCount >= 8) {
            optimizations['maxAgents'] = 8;
            optimizations['fileWatcher.maxConcurrentAnalysis'] = 4;
        } else if (systemInfo.cpuCount >= 4) {
            optimizations['maxAgents'] = 4;
            optimizations['fileWatcher.maxConcurrentAnalysis'] = 2;
        } else {
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

    private initializeSettingsGroups(): void {
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

        // LM Studio settings group
        this.addSettingsGroup({
            id: 'lmstudio',
            title: 'LM Studio',
            description: 'LM Studio integration and chat settings',
            icon: '🤖',
            order: 4,
            settings: {
                'lmstudio.enabled': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable LM Studio integration'
                },
                'lmstudio.connection.host': {
                    type: 'string',
                    default: 'localhost',
                    description: 'LM Studio server host'
                },
                'lmstudio.connection.port': {
                    type: 'number',
                    default: 1234,
                    minimum: 1,
                    maximum: 65535,
                    description: 'LM Studio server port'
                },
                'lmstudio.connection.apiKey': {
                    type: 'string',
                    default: '',
                    description: 'LM Studio API key (optional)'
                },
                'lmstudio.connection.timeout': {
                    type: 'number',
                    default: 30000,
                    minimum: 5000,
                    maximum: 120000,
                    description: 'Connection timeout in milliseconds'
                },
                'lmstudio.model.name': {
                    type: 'string',
                    default: 'gemma-3-4b',
                    description: 'Default model name'
                },
                'lmstudio.model.temperature': {
                    type: 'number',
                    default: 0.7,
                    minimum: 0.0,
                    maximum: 2.0,
                    description: 'Model temperature for response generation'
                },
                'lmstudio.model.maxTokens': {
                    type: 'number',
                    default: 2048,
                    minimum: 100,
                    maximum: 8192,
                    description: 'Maximum tokens per response'
                },
                'lmstudio.model.contextWindow': {
                    type: 'number',
                    default: 8192,
                    minimum: 1024,
                    maximum: 32768,
                    description: 'Model context window size'
                },
                'lmstudio.tools.enabledTools': {
                    type: 'array',
                    default: ['analyze', 'read', 'generate', 'explain', 'review', 'optimize'],
                    description: 'Enabled swarm tools for LM Studio'
                },
                'lmstudio.tools.maxConcurrentCalls': {
                    type: 'number',
                    default: 3,
                    minimum: 1,
                    maximum: 10,
                    description: 'Maximum concurrent tool calls'
                },
                'lmstudio.tools.toolTimeout': {
                    type: 'number',
                    default: 15000,
                    minimum: 5000,
                    maximum: 60000,
                    description: 'Tool execution timeout in milliseconds'
                },
                'lmstudio.optimization.contextCompression': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable context compression for better performance'
                },
                'lmstudio.optimization.smartTruncation': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable smart context truncation'
                },
                'lmstudio.optimization.cacheResults': {
                    type: 'boolean',
                    default: true,
                    description: 'Cache tool results for better performance'
                },
                'lmstudio.chat.autoConnect': {
                    type: 'boolean',
                    default: true,
                    description: 'Automatically connect to LM Studio on startup'
                },
                'lmstudio.chat.showToolCalls': {
                    type: 'boolean',
                    default: true,
                    description: 'Show tool call details in chat'
                },
                'lmstudio.chat.maxHistoryLength': {
                    type: 'number',
                    default: 50,
                    minimum: 10,
                    maximum: 200,
                    description: 'Maximum chat history length'
                }
            }
        });
    }

    private async loadSettingsSchema(): Promise<void> {
        // Load additional settings schema from configuration files
        // This could be extended to load from external schema files
    }

    private setupConfigurationListener(): void {
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('ruv-swarm')) {
                // Handle configuration changes
                this.outputChannel.appendLine('🔄 Configuration changed');
            }
        });
    }

    dispose(): void {
        this.eventEmitter.dispose();
        this.outputChannel.dispose();
        this.changeListeners.clear();
        this.settingsGroups.clear();
    }
}
