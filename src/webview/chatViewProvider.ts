import * as vscode from 'vscode';
import { LMStudioServer } from '../mcp/servers/lmStudioServer';
import { SwarmManager } from '../utils/swarmManager';
import { ChatMessage, ToolCall } from './lmStudioChat';

export class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    public static readonly viewType = 'ruv-swarm.chat';

    private _view?: vscode.WebviewView;
    private context: vscode.ExtensionContext;
    private lmStudioServer: LMStudioServer;
    private swarmManager: SwarmManager;
    private chatHistory: ChatMessage[] = [];
    private isProcessing = false;
    private outputChannel: vscode.OutputChannel;

    constructor(
        context: vscode.ExtensionContext,
        lmStudioServer: LMStudioServer,
        swarmManager: SwarmManager
    ) {
        this.context = context;
        this.lmStudioServer = lmStudioServer;
        this.swarmManager = swarmManager;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Chat');
        
        this.setupEventListeners();
        this.loadChatHistory();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri]
        };

        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            await this.handleMessage(data);
        });

        // Update the view when it becomes visible
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this.updateChatUI();
            }
        });

        // Initial update
        this.updateChatUI();
    }

    private async handleMessage(data: any): Promise<void> {
        try {
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.content);
                    break;
                    
                case 'clearChat':
                    await this.clearChat();
                    break;
                    
                case 'quickAction':
                    await this.handleQuickAction(data.action);
                    break;
                    
                case 'checkConnection':
                    await this.checkConnection();
                    break;
                    
                case 'retryMessage':
                    await this.retryLastMessage();
                    break;
                    
                default:
                    this.outputChannel.appendLine(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`Error handling message: ${error}`);
        }
    }

    private async handleUserMessage(content: string): Promise<void> {
        if (this.isProcessing) {
            vscode.window.showWarningMessage('Please wait for the current message to complete');
            return;
        }

        if (!this.lmStudioServer.isConnected) {
            vscode.window.showErrorMessage('LM Studio is not connected. Please check your configuration.');
            return;
        }

        this.isProcessing = true;

        try {
            // Add user message to history
            const userMessage: ChatMessage = {
                id: this.generateMessageId(),
                role: 'user',
                content,
                timestamp: new Date()
            };
            
            this.chatHistory.push(userMessage);
            await this.updateChatUI();

            // Get current context
            const context = await this.getCurrentContext();
            
            // Send to LM Studio and get response
            const response = await this.sendToLMStudio(content, context);
            
            // Add assistant response to history
            const assistantMessage: ChatMessage = {
                id: this.generateMessageId(),
                role: 'assistant',
                content: response.content,
                timestamp: new Date(),
                toolCalls: response.toolCalls,
                metadata: response.metadata
            };
            
            this.chatHistory.push(assistantMessage);
            await this.updateChatUI();
            await this.saveChatHistory();

        } catch (error) {
            this.outputChannel.appendLine(`Error processing message: ${error}`);
            
            // Add error message
            const errorMessage: ChatMessage = {
                id: this.generateMessageId(),
                role: 'system',
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date()
            };
            
            this.chatHistory.push(errorMessage);
            await this.updateChatUI();
            
        } finally {
            this.isProcessing = false;
        }
    }

    private async handleQuickAction(action: string): Promise<void> {
        const activeEditor = vscode.window.activeTextEditor;
        let message = '';

        switch (action) {
            case 'analyzeFile':
                if (activeEditor) {
                    message = `Analyze the current file: ${activeEditor.document.fileName}`;
                } else {
                    message = 'Analyze the current workspace structure';
                }
                break;
                
            case 'generateTests':
                if (activeEditor) {
                    message = `Generate comprehensive tests for the current file: ${activeEditor.document.fileName}`;
                } else {
                    vscode.window.showWarningMessage('Please open a file to generate tests');
                    return;
                }
                break;
                
            case 'explainCode':
                if (activeEditor && activeEditor.selection && !activeEditor.selection.isEmpty) {
                    const selectedText = activeEditor.document.getText(activeEditor.selection);
                    message = `Explain this code:\n\n\`\`\`\n${selectedText}\n\`\`\``;
                } else if (activeEditor) {
                    message = `Explain the current file: ${activeEditor.document.fileName}`;
                } else {
                    vscode.window.showWarningMessage('Please open a file or select code to explain');
                    return;
                }
                break;
                
            case 'swarmStatus':
                message = 'What is the current swarm status and performance metrics?';
                break;
                
            case 'codeReview':
                if (activeEditor) {
                    message = `Perform a comprehensive code review of: ${activeEditor.document.fileName}`;
                } else {
                    vscode.window.showWarningMessage('Please open a file for code review');
                    return;
                }
                break;
                
            default:
                vscode.window.showWarningMessage(`Unknown quick action: ${action}`);
                return;
        }

        await this.handleUserMessage(message);
    }

    private async getCurrentContext(): Promise<{
        activeFile?: string;
        selectedText?: string;
        workspaceName?: string;
        swarmStatus?: any;
    }> {
        const activeEditor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        
        let selectedText: string | undefined;
        if (activeEditor && activeEditor.selection && !activeEditor.selection.isEmpty) {
            selectedText = activeEditor.document.getText(activeEditor.selection);
        }

        let swarmStatus;
        try {
            swarmStatus = await this.swarmManager.getSwarmStatus();
        } catch (error) {
            // Swarm status not available
        }

        return {
            activeFile: activeEditor?.document.fileName,
            selectedText,
            workspaceName: workspaceFolder?.name,
            swarmStatus
        };
    }

    private async sendToLMStudio(userMessage: string, context: any): Promise<{
        content: string;
        toolCalls?: ToolCall[];
        metadata?: any;
    }> {
        const startTime = Date.now();
        
        // Build system prompt with context
        const systemPrompt = this.buildSystemPrompt(context);
        
        // Get conversation history for context
        const conversationHistory = this.chatHistory.slice(-10);
        
        // Simulate LM Studio response (replace with actual API call)
        const response = await this.simulateLMStudioResponse(systemPrompt, conversationHistory, userMessage, context);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return {
            content: response.content,
            toolCalls: response.toolCalls,
            metadata: {
                model: 'LM Studio Model',
                tokens: response.content.length,
                responseTime
            }
        };
    }

    private buildSystemPrompt(context: any): string {
        return `You are an AI assistant integrated with the RUV-Swarm system. You have access to powerful tools for code analysis, testing, and development assistance.

Current Context:
- Workspace: ${context.workspaceName || 'No workspace'}
- Active File: ${context.activeFile || 'None'}
- Selected Text: ${context.selectedText ? 'Yes' : 'No'}
- Swarm Status: ${context.swarmStatus ? 'Active' : 'Inactive'}

Available capabilities:
- Code analysis and review
- Test generation
- Performance optimization
- Security analysis
- Code explanation and documentation
- Swarm intelligence coordination

Provide helpful, concise responses and use tools when appropriate to assist with development tasks.`;
    }

    private async simulateLMStudioResponse(systemPrompt: string, history: ChatMessage[], userMessage: string, context: any): Promise<{
        content: string;
        toolCalls?: ToolCall[];
    }> {
        // This would be replaced with actual LM Studio API integration
        const toolCalls: ToolCall[] = [];
        let content = '';

        // Simple pattern matching for demonstration
        if (userMessage.toLowerCase().includes('analyze') && context.activeFile) {
            const toolCall: ToolCall = {
                id: this.generateMessageId(),
                name: 'analyze_file',
                arguments: { filePath: context.activeFile },
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            };
            
            toolCalls.push(toolCall);
            content = `I've analyzed the file ${context.activeFile}. Here are the key findings:\n\n• Code structure looks good\n• No major issues detected\n• Consider adding more comments for clarity`;
            
        } else if (userMessage.toLowerCase().includes('test') && context.activeFile) {
            const toolCall: ToolCall = {
                id: this.generateMessageId(),
                name: 'generate_tests',
                arguments: { filePath: context.activeFile },
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            };
            
            toolCalls.push(toolCall);
            content = `I've generated comprehensive tests for ${context.activeFile}. The tests cover:\n\n• Unit tests for main functions\n• Edge case handling\n• Error scenarios\n• Integration tests`;
            
        } else if (userMessage.toLowerCase().includes('swarm status')) {
            content = `Current Swarm Status:\n\n• Status: ${context.swarmStatus ? 'Active' : 'Inactive'}\n• Agents: ${context.swarmStatus?.activeAgents || 0} active\n• Performance: ${context.swarmStatus?.performance?.successRate ? (context.swarmStatus.performance.successRate * 100).toFixed(1) + '%' : 'N/A'} success rate`;
            
        } else {
            content = `I'm here to help with your development tasks! I can:\n\n• **Analyze code** - Review files for issues and improvements\n• **Generate tests** - Create comprehensive test suites\n• **Explain code** - Provide detailed explanations\n• **Review code** - Perform thorough code reviews\n• **Monitor swarm** - Check swarm intelligence status\n\nWhat would you like me to help you with?`;
        }

        return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }

    private async clearChat(): Promise<void> {
        this.chatHistory = [];
        await this.updateChatUI();
        await this.saveChatHistory();
        this.outputChannel.appendLine('Chat history cleared');
    }

    private async checkConnection(): Promise<void> {
        try {
            if (this.lmStudioServer.isConnected) {
                vscode.window.showInformationMessage('✅ LM Studio is connected and ready!');
            } else {
                await this.lmStudioServer.connect();
                vscode.window.showInformationMessage('✅ Connected to LM Studio!');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to connect to LM Studio: ${error}`);
        }
        
        await this.updateChatUI();
    }

    private async retryLastMessage(): Promise<void> {
        const lastUserMessage = [...this.chatHistory].reverse().find(msg => msg.role === 'user');
        if (lastUserMessage) {
            // Remove the last assistant response if it exists
            const lastIndex = this.chatHistory.length - 1;
            if (this.chatHistory[lastIndex]?.role === 'assistant') {
                this.chatHistory.pop();
            }
            
            await this.handleUserMessage(lastUserMessage.content);
        }
    }

    private async updateChatUI(): Promise<void> {
        if (!this._view) return;

        this._view.webview.postMessage({
            type: 'updateChat',
            data: {
                messages: this.chatHistory,
                isConnected: this.lmStudioServer.isConnected,
                isProcessing: this.isProcessing,
                timestamp: new Date().toISOString()
            }
        });
    }

    private async loadChatHistory(): Promise<void> {
        try {
            const savedHistory = this.context.globalState.get<ChatMessage[]>('chatHistory', []);
            this.chatHistory = savedHistory;
        } catch (error) {
            this.outputChannel.appendLine(`Failed to load chat history: ${error}`);
        }
    }

    private async saveChatHistory(): Promise<void> {
        try {
            await this.context.globalState.update('chatHistory', this.chatHistory);
        } catch (error) {
            this.outputChannel.appendLine(`Failed to save chat history: ${error}`);
        }
    }

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private setupEventListeners(): void {
        // Listen to LM Studio server events
        this.lmStudioServer.on('connected', () => {
            this.outputChannel.appendLine('LM Studio connected');
            this.updateChatUI();
        });

        this.lmStudioServer.on('disconnected', () => {
            this.outputChannel.appendLine('LM Studio disconnected');
            this.updateChatUI();
        });
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Chat</title>
            <style>
                :root {
                    --primary-color: #007acc;
                    --success-color: #28a745;
                    --warning-color: #ffc107;
                    --danger-color: #dc3545;
                    --info-color: #17a2b8;
                    --border-radius: 6px;
                    --spacing: 8px;
                    --transition: all 0.2s ease;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-sideBar-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .chat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing);
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                    background-color: var(--vscode-sideBarSectionHeader-background);
                    flex-shrink: 0;
                }

                .chat-title {
                    font-size: 13px;
                    font-weight: 600;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .connection-status {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 10px;
                }

                .status-indicator {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background-color: var(--danger-color);
                }

                .status-indicator.connected {
                    background-color: var(--success-color);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .header-actions {
                    display: flex;
                    gap: 4px;
                }

                .header-btn {
                    padding: 2px 4px;
                    background: none;
                    border: none;
                    color: var(--vscode-foreground);
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 10px;
                    opacity: 0.7;
                    transition: var(--transition);
                }

                .header-btn:hover {
                    opacity: 1;
                    background-color: var(--vscode-toolbar-hoverBackground);
                }

                .quick-actions {
                    padding: var(--spacing);
                    border-bottom: 1px solid var(--vscode-sideBar-border);
                    background-color: var(--vscode-sideBar-background);
                    flex-shrink: 0;
                }

                .quick-actions-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 4px;
                }

                .quick-action-btn {
                    padding: 6px 8px;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 10px;
                    text-align: center;
                    transition: var(--transition);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .quick-action-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .chat-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: var(--spacing);
                    display: flex;
                    flex-direction: column;
                    gap: var(--spacing);
                }

                .message {
                    display: flex;
                    flex-direction: column;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message.user {
                    align-items: flex-end;
                }

                .message.assistant {
                    align-items: flex-start;
                }

                .message.system {
                    align-items: center;
                }

                .message-content {
                    max-width: 85%;
                    padding: 8px 10px;
                    border-radius: var(--border-radius);
                    word-wrap: break-word;
                    white-space: pre-wrap;
                    font-size: 12px;
                    line-height: 1.4;
                }

                .message.user .message-content {
                    background-color: var(--primary-color);
                    color: white;
                    border-bottom-right-radius: 3px;
                }

                .message.assistant .message-content {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    border-bottom-left-radius: 3px;
                }

                .message.system .message-content {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    font-style: italic;
                    text-align: center;
                    max-width: 95%;
                    font-size: 11px;
                }

                .message-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 2px;
                    font-size: 9px;
                    color: var(--vscode-descriptionForeground);
                    padding: 0 4px;
                }

                .message-time {
                    opacity: 0.7;
                }

                .tool-calls {
                    margin-top: 6px;
                    padding: 6px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: var(--border-radius);
                    border-left: 2px solid var(--info-color);
                    max-width: 85%;
                }

                .tool-call {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 3px;
                    margin-bottom: 3px;
                    background-color: var(--vscode-input-background);
                    border-radius: 3px;
                    font-size: 10px;
                }

                .tool-call:last-child {
                    margin-bottom: 0;
                }

                .tool-info {
                    flex: 1;
                    min-width: 0;
                }

                .tool-name {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .tool-status {
                    padding: 1px 4px;
                    border-radius: 2px;
                    font-size: 8px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .tool-status.completed { background-color: var(--success-color); color: white; }
                .tool-status.failed { background-color: var(--danger-color); color: white; }

                .chat-input-container {
                    padding: var(--spacing);
                    border-top: 1px solid var(--vscode-sideBar-border);
                    background-color: var(--vscode-sideBar-background);
                    flex-shrink: 0;
                }

                .chat-input-wrapper {
                    display: flex;
                    gap: 6px;
                    align-items: flex-end;
                }

                .chat-input {
                    flex: 1;
                    min-height: 32px;
                    max-height: 80px;
                    padding: 6px 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: var(--border-radius);
                    resize: none;
                    font-family: inherit;
                    font-size: 12px;
                    line-height: 1.3;
                }

                .chat-input:focus {
                    outline: none;
                    border-color: var(--primary-color);
                }

                .chat-input:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .send-btn {
                    padding: 6px 10px;
                    background-color: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 11px;
                    transition: var(--transition);
                    min-width: 45px;
                }

                .send-btn:hover:not(:disabled) {
                    background-color: #005a9e;
                }

                .send-btn:disabled {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-descriptionForeground);
                    cursor: not-allowed;
                }

                .empty-state {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    padding: 20px;
                }

                .empty-state h3 {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                }

                .empty-state p {
                    margin: 0;
                    font-size: 11px;
                    line-height: 1.4;
                }

                .processing-indicator {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 8px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing);
                    animation: fadeIn 0.3s ease;
                    font-size: 11px;
                }

                .spinner {
                    width: 12px;
                    height: 12px;
                    border: 1px solid var(--vscode-descriptionForeground);
                    border-top: 1px solid var(--primary-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .retry-btn {
                    margin-left: auto;
                    padding: 1px 4px;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 2px;
                    cursor: pointer;
                    font-size: 8px;
                    transition: var(--transition);
                }

                .retry-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                /* Scrollbar styling */
                .chat-messages::-webkit-scrollbar {
                    width: 6px;
                }

                .chat-messages::-webkit-scrollbar-track {
                    background: var(--vscode-scrollbarSlider-background);
                }

                .chat-messages::-webkit-scrollbar-thumb {
                    background: var(--vscode-scrollbarSlider-background);
                    border-radius: 3px;
                }

                .chat-messages::-webkit-scrollbar-thumb:hover {
                    background: var(--vscode-scrollbarSlider-hoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="chat-header">
                <h1 class="chat-title">
                    🤖 AI Chat
                </h1>
                <div class="connection-status">
                    <div id="statusIndicator" class="status-indicator"></div>
                    <span id="statusText">Offline</span>
                </div>
                <div class="header-actions">
                    <button id="clearBtn" class="header-btn" title="Clear Chat">🗑️</button>
                </div>
            </div>

            <div class="quick-actions">
                <div class="quick-actions-grid">
                    <button class="quick-action-btn" onclick="quickAction('analyzeFile')">🔍 Analyze</button>
                    <button class="quick-action-btn" onclick="quickAction('generateTests')">🧪 Tests</button>
                    <button class="quick-action-btn" onclick="quickAction('explainCode')">📖 Explain</button>
                    <button class="quick-action-btn" onclick="quickAction('swarmStatus')">📊 Status</button>
                </div>
            </div>

            <div class="chat-container">
                <div id="chatMessages" class="chat-messages">
                    <div class="empty-state">
                        <h3>🤖 AI Assistant Ready</h3>
                        <p>Ask me anything about your code, or use the quick actions above!</p>
                    </div>
                </div>

                <div class="chat-input-container">
                    <div class="chat-input-wrapper">
                        <textarea id="chatInput" class="chat-input" placeholder="Ask me anything..." rows="1"></textarea>
                        <button id="sendBtn" class="send-btn">Send</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentData = null;
                let isProcessing = false;

                document.addEventListener('DOMContentLoaded', () => {
                    setupEventListeners();
                });

                function setupEventListeners() {
                    // Header buttons
                    document.getElementById('clearBtn').addEventListener('click', clearChat);

                    // Chat input
                    const chatInput = document.getElementById('chatInput');
                    const sendBtn = document.getElementById('sendBtn');

                    chatInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    });

                    chatInput.addEventListener('input', () => {
                        autoResizeTextarea(chatInput);
                        updateSendButton();
                    });

                    sendBtn.addEventListener('click', sendMessage);
                }

                function autoResizeTextarea(textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
                }

                function updateSendButton() {
                    const chatInput = document.getElementById('chatInput');
                    const sendBtn = document.getElementById('sendBtn');
                    const hasContent = chatInput.value.trim().length > 0;
                    
                    sendBtn.disabled = !hasContent || isProcessing;
                    sendBtn.textContent = isProcessing ? 'Sending...' : 'Send';
                }

                function sendMessage() {
                    const chatInput = document.getElementById('chatInput');
                    const message = chatInput.value.trim();
                    
                    if (!message || isProcessing) return;

                    chatInput.value = '';
                    autoResizeTextarea(chatInput);
                    updateSendButton();

                    vscode.postMessage({
                        type: 'sendMessage',
                        content: message
                    });
                }

                function quickAction(action) {
                    vscode.postMessage({
                        type: 'quickAction',
                        action: action
                    });
                }

                function clearChat() {
                    if (confirm('Are you sure you want to clear the chat history?')) {
                        vscode.postMessage({ type: 'clearChat' });
                    }
                }

                function retryMessage() {
                    vscode.postMessage({ type: 'retryMessage' });
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.type) {
                        case 'updateChat':
                            updateChatDisplay(message.data);
                            break;
                    }
                });

                function updateChatDisplay(data) {
                    currentData = data;
                    isProcessing = data.isProcessing;

                    // Update connection status
                    const statusIndicator = document.getElementById('statusIndicator');
                    const statusText = document.getElementById('statusText');
                    
                    if (data.isConnected) {
                        statusIndicator.classList.add('connected');
                        statusText.textContent = 'Online';
                    } else {
                        statusIndicator.classList.remove('connected');
                        statusText.textContent = 'Offline';
                    }

                    // Update messages
                    updateMessages(data.messages);
                    
                    // Update input state
                    updateSendButton();
                }

                function updateMessages(messages) {
                    const chatMessages = document.getElementById('chatMessages');
                    
                    if (messages.length === 0) {
                        chatMessages.innerHTML = \`
                            <div class="empty-state">
                                <h3>🤖 AI Assistant Ready</h3>
                                <p>Ask me anything about your code, or use the quick actions above!</p>
                            </div>
                        \`;
                        return;
                    }

                    let messagesHTML = '';
                    
                    // Add processing indicator if processing
                    if (isProcessing) {
                        messagesHTML += \`
                            <div class="processing-indicator">
                                <div class="spinner"></div>
                                <span>Processing your request...</span>
                            </div>
                        \`;
                    }

                    messages.forEach(message => {
                        messagesHTML += renderMessage(message);
                    });

                    chatMessages.innerHTML = messagesHTML;
                    
                    // Scroll to bottom
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

                function renderMessage(message) {
                    const time = new Date(message.timestamp).toLocaleTimeString();
                    let toolCallsHTML = '';
                    
                    if (message.toolCalls && message.toolCalls.length > 0) {
                        toolCallsHTML = \`
                            <div class="tool-calls">
                                <strong>🔧 Tool Calls:</strong>
                                \${message.toolCalls.map(tool => \`
                                    <div class="tool-call">
                                        <div class="tool-info">
                                            <div class="tool-name">\${tool.name}</div>
                                        </div>
                                        <span class="tool-status \${tool.status}">\${tool.status}</span>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }

                    let metadataHTML = '';
                    if (message.metadata) {
                        metadataHTML = \`
                            <div class="message-metadata">
                                \${message.metadata.responseTime ? \`<span>\${message.metadata.responseTime}ms</span>\` : ''}
                            </div>
                        \`;
                    }

                    return \`
                        <div class="message \${message.role}">
                            <div class="message-content">\${message.content}</div>
                            \${toolCallsHTML}
                            <div class="message-meta">
                                <span class="message-time">\${time}</span>
                                \${metadataHTML}
                                \${message.role === 'assistant' && !isProcessing ? '<button class="retry-btn" onclick="retryMessage()">🔄</button>' : ''}
                            </div>
                        </div>
                    \`;
                }
            </script>
        </body>
        </html>
        `;
    }

    dispose(): void {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
        this.lmStudioServer.removeAllListeners();
    }
}
