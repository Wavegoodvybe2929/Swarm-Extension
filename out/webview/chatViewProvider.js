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
exports.ChatViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class ChatViewProvider {
    constructor(context, lmStudioServer, swarmManager) {
        this.chatHistory = [];
        this.isProcessing = false;
        this.context = context;
        this.lmStudioServer = lmStudioServer;
        this.swarmManager = swarmManager;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm Chat');
        this.setupEventListeners();
        this.loadChatHistory();
    }
    resolveWebviewView(webviewView, context, _token) {
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
    async handleMessage(data) {
        try {
            this.outputChannel.appendLine(`📨 Received message: ${data.type}`);
            switch (data.type) {
                case 'sendMessage':
                    await this.handleUserMessage(data.content);
                    break;
                case 'clearChat':
                    this.outputChannel.appendLine('🗑️ Processing clearChat request...');
                    await this.clearChat();
                    this.outputChannel.appendLine('✅ clearChat completed');
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
                case 'debug':
                    this.outputChannel.appendLine(`🐛 Debug: ${data.message} (${data.timestamp})`);
                    break;
                default:
                    this.outputChannel.appendLine(`Unknown message type: ${data.type}`);
            }
        }
        catch (error) {
            this.outputChannel.appendLine(`Error handling message: ${error}`);
        }
    }
    async handleUserMessage(content) {
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
            const userMessage = {
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
            const assistantMessage = {
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
        }
        catch (error) {
            this.outputChannel.appendLine(`Error processing message: ${error}`);
            // Add error message
            const errorMessage = {
                id: this.generateMessageId(),
                role: 'system',
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: new Date()
            };
            this.chatHistory.push(errorMessage);
            await this.updateChatUI();
        }
        finally {
            this.isProcessing = false;
        }
    }
    async handleQuickAction(action) {
        const activeEditor = vscode.window.activeTextEditor;
        let message = '';
        switch (action) {
            case 'analyzeFile':
                if (activeEditor) {
                    message = `Analyze the current file: ${activeEditor.document.fileName}`;
                }
                else {
                    message = 'Analyze the current workspace structure';
                }
                break;
            case 'generateTests':
                if (activeEditor) {
                    message = `Generate comprehensive tests for the current file: ${activeEditor.document.fileName}`;
                }
                else {
                    vscode.window.showWarningMessage('Please open a file to generate tests');
                    return;
                }
                break;
            case 'explainCode':
                if (activeEditor && activeEditor.selection && !activeEditor.selection.isEmpty) {
                    const selectedText = activeEditor.document.getText(activeEditor.selection);
                    message = `Explain this code:\n\n\`\`\`\n${selectedText}\n\`\`\``;
                }
                else if (activeEditor) {
                    message = `Explain the current file: ${activeEditor.document.fileName}`;
                }
                else {
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
                }
                else {
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
    async getCurrentContext() {
        const activeEditor = vscode.window.activeTextEditor;
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        let selectedText;
        if (activeEditor && activeEditor.selection && !activeEditor.selection.isEmpty) {
            selectedText = activeEditor.document.getText(activeEditor.selection);
        }
        let swarmStatus;
        try {
            swarmStatus = await this.swarmManager.getSwarmStatus();
        }
        catch (error) {
            // Swarm status not available
        }
        return {
            activeFile: activeEditor?.document.fileName,
            selectedText,
            workspaceName: workspaceFolder?.name,
            swarmStatus
        };
    }
    async sendToLMStudio(userMessage, context) {
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
    buildSystemPrompt(context) {
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
    async simulateLMStudioResponse(systemPrompt, history, userMessage, context) {
        // This would be replaced with actual LM Studio API integration
        const toolCalls = [];
        let content = '';
        // Simple pattern matching for demonstration
        if (userMessage.toLowerCase().includes('analyze') && context.activeFile) {
            const toolCall = {
                id: this.generateMessageId(),
                name: 'analyze_file',
                arguments: { filePath: context.activeFile },
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            };
            toolCalls.push(toolCall);
            content = `I've analyzed the file ${context.activeFile}. Here are the key findings:\n\n• Code structure looks good\n• No major issues detected\n• Consider adding more comments for clarity`;
        }
        else if (userMessage.toLowerCase().includes('test') && context.activeFile) {
            const toolCall = {
                id: this.generateMessageId(),
                name: 'generate_tests',
                arguments: { filePath: context.activeFile },
                status: 'completed',
                startTime: new Date(),
                endTime: new Date()
            };
            toolCalls.push(toolCall);
            content = `I've generated comprehensive tests for ${context.activeFile}. The tests cover:\n\n• Unit tests for main functions\n• Edge case handling\n• Error scenarios\n• Integration tests`;
        }
        else if (userMessage.toLowerCase().includes('swarm status')) {
            content = `Current Swarm Status:\n\n• Status: ${context.swarmStatus ? 'Active' : 'Inactive'}\n• Agents: ${context.swarmStatus?.activeAgents || 0} active\n• Performance: ${context.swarmStatus?.performance?.successRate ? (context.swarmStatus.performance.successRate * 100).toFixed(1) + '%' : 'N/A'} success rate`;
        }
        else {
            content = `I'm here to help with your development tasks! I can:\n\n• **Analyze code** - Review files for issues and improvements\n• **Generate tests** - Create comprehensive test suites\n• **Explain code** - Provide detailed explanations\n• **Review code** - Perform thorough code reviews\n• **Monitor swarm** - Check swarm intelligence status\n\nWhat would you like me to help you with?`;
        }
        return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }
    async clearChat() {
        this.outputChannel.appendLine(`🗑️ Starting clearChat - current history length: ${this.chatHistory.length}`);
        try {
            // Clear the chat history
            this.chatHistory = [];
            this.outputChannel.appendLine('✅ Chat history array cleared');
            // Force UI update with explicit empty state
            await this.updateChatUI();
            this.outputChannel.appendLine('✅ UI update sent');
            // Save the cleared state
            await this.saveChatHistory();
            this.outputChannel.appendLine('✅ Chat history saved to globalState');
            // Send a confirmation message to the webview with force clear flag
            if (this._view) {
                await this._view.webview.postMessage({
                    type: 'chatCleared',
                    data: {
                        timestamp: new Date().toISOString(),
                        forceClear: true
                    }
                });
                this.outputChannel.appendLine('✅ Chat cleared confirmation sent to webview');
                // Also send a direct update with empty messages
                await this._view.webview.postMessage({
                    type: 'updateChat',
                    data: {
                        messages: [],
                        isConnected: this.lmStudioServer.isConnected,
                        isProcessing: false,
                        timestamp: new Date().toISOString(),
                        forceClear: true
                    }
                });
                this.outputChannel.appendLine('✅ Direct empty update sent to webview');
            }
            this.outputChannel.appendLine('🎉 clearChat operation completed successfully');
            // Show success message to user
            vscode.window.showInformationMessage('Chat history cleared successfully!');
        }
        catch (error) {
            this.outputChannel.appendLine(`❌ Error during clearChat: ${error}`);
            vscode.window.showErrorMessage(`Failed to clear chat: ${error}`);
        }
    }
    async checkConnection() {
        try {
            if (this.lmStudioServer.isConnected) {
                vscode.window.showInformationMessage('✅ LM Studio is connected and ready!');
            }
            else {
                await this.lmStudioServer.connect();
                vscode.window.showInformationMessage('✅ Connected to LM Studio!');
            }
        }
        catch (error) {
            vscode.window.showErrorMessage(`❌ Failed to connect to LM Studio: ${error}`);
        }
        await this.updateChatUI();
    }
    async retryLastMessage() {
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
    async updateChatUI() {
        if (!this._view)
            return;
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
    async loadChatHistory() {
        try {
            const savedHistory = this.context.globalState.get('chatHistory', []);
            this.chatHistory = savedHistory;
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to load chat history: ${error}`);
        }
    }
    async saveChatHistory() {
        try {
            await this.context.globalState.update('chatHistory', this.chatHistory);
        }
        catch (error) {
            this.outputChannel.appendLine(`Failed to save chat history: ${error}`);
        }
    }
    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    setupEventListeners() {
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
    getHtmlForWebview(webview) {
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

                // Initialize immediately and also on DOMContentLoaded
                function initializeChat() {
                    console.log('🚀 Initializing chat interface...');
                    setupEventListeners();
                    
                    // Send initial debug message to backend
                    console.log('📤 Sending initial debug message to backend');
                    vscode.postMessage({ 
                        type: 'debug',
                        message: 'Chat interface initialized',
                        timestamp: new Date().toISOString()
                    });
                }

                // Try to initialize immediately
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initializeChat);
                } else {
                    // DOM is already ready
                    initializeChat();
                }

                function setupEventListeners() {
                    console.log('🔧 Setting up event listeners...');
                    
                    // Send debug info about DOM state
                    vscode.postMessage({ 
                        type: 'debug',
                        message: \`DOM readyState: \${document.readyState}\`,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Add multiple attempts with increasing delays
                    const attempts = [50, 100, 250, 500, 1000];
                    
                    attempts.forEach((delay, index) => {
                        setTimeout(() => {
                            console.log(\`🔄 Attempt \${index + 1} to setup event listeners (delay: \${delay}ms)\`);
                            
                            // Send debug message to backend
                            vscode.postMessage({ 
                                type: 'debug',
                                message: \`Event listener setup attempt \${index + 1}\`,
                                timestamp: new Date().toISOString()
                            });
                            
                            // Header buttons
                            const clearBtn = document.getElementById('clearBtn');
                            console.log(\`🔍 Attempt \${index + 1} - Looking for clear button:\`, clearBtn);
                            
                            if (clearBtn) {
                                // Check if listener is already attached
                                const hasListener = clearBtn.onclick !== null || clearBtn.getAttribute('data-listener-attached') === 'true';
                                console.log(\`🧪 Clear button found! Has listener: \${hasListener}\`);
                                
                                if (!hasListener) {
                                    // Remove any existing listeners first
                                    clearBtn.removeEventListener('click', clearChat);
                                    
                                    // Use multiple attachment methods for maximum compatibility
                                    clearBtn.addEventListener('click', clearChat, { capture: false, passive: false });
                                    clearBtn.onclick = clearChat; // Fallback method
                                    clearBtn.setAttribute('data-listener-attached', 'true');
                                    
                                    console.log(\`✅ Clear button event listener attached on attempt \${index + 1}\`);
                                    
                                    // Send success message to backend
                                    vscode.postMessage({ 
                                        type: 'debug',
                                        message: \`Clear button listener attached successfully on attempt \${index + 1}\`,
                                        timestamp: new Date().toISOString()
                                    });
                                    
                                    // Test the button immediately
                                    console.log('🧪 Testing clear button accessibility...');
                                    console.log('Button element:', clearBtn);
                                    console.log('Button text:', clearBtn.textContent);
                                    console.log('Button disabled:', clearBtn.disabled);
                                    console.log('Button style display:', getComputedStyle(clearBtn).display);
                                    console.log('Button style visibility:', getComputedStyle(clearBtn).visibility);
                                    console.log('Button z-index:', getComputedStyle(clearBtn).zIndex);
                                    console.log('Button pointer-events:', getComputedStyle(clearBtn).pointerEvents);
                                    
                                    // Check if button is actually clickable
                                    const rect = clearBtn.getBoundingClientRect();
                                    console.log('Button position:', {
                                        top: rect.top,
                                        left: rect.left,
                                        width: rect.width,
                                        height: rect.height,
                                        visible: rect.width > 0 && rect.height > 0
                                    });
                                    
                                    // Test click programmatically (but skip confirm dialog)
                                    try {
                                        console.log('🧪 Testing programmatic click...');
                                        // Add a test flag to skip confirm dialog
                                        window.testMode = true;
                                        clearBtn.click();
                                        window.testMode = false;
                                        console.log('✅ Programmatic click succeeded');
                                    } catch (error) {
                                        console.error('❌ Programmatic click failed:', error);
                                        vscode.postMessage({ 
                                            type: 'debug',
                                            message: \`Programmatic click error: \${error.message}\`,
                                            timestamp: new Date().toISOString()
                                        });
                                    }
                                    
                                    // Add comprehensive event debugging
                                    ['mousedown', 'mouseup', 'click', 'touchstart', 'touchend'].forEach(eventType => {
                                        clearBtn.addEventListener(eventType, function(e) {
                                            console.log(\`🖱️ \${eventType} event detected on clear button\`, e);
                                            vscode.postMessage({ 
                                                type: 'debug',
                                                message: \`Clear button \${eventType} event detected\`,
                                                timestamp: new Date().toISOString()
                                            });
                                        }, { capture: true, passive: false });
                                    });
                                    
                                    // Add a direct onclick test
                                    setTimeout(() => {
                                        console.log('🧪 Testing direct onclick assignment...');
                                        const originalOnclick = clearBtn.onclick;
                                        console.log('Original onclick:', originalOnclick);
                                        
                                        // Test if onclick is working
                                        if (typeof originalOnclick === 'function') {
                                            console.log('✅ onclick is a function');
                                        } else {
                                            console.log('❌ onclick is not a function:', typeof originalOnclick);
                                        }
                                    }, 100);
                                    
                                } else {
                                    console.log(\`⚠️ Clear button already has listener on attempt \${index + 1}\`);
                                }
                            } else {
                                console.error(\`❌ Clear button not found on attempt \${index + 1}!\`);
                                
                                // List all buttons for debugging
                                const allButtons = document.querySelectorAll('button');
                                console.log(\`🔍 All buttons found on attempt \${index + 1}:\`, allButtons.length);
                                allButtons.forEach((btn, btnIndex) => {
                                    console.log(\`Button \${btnIndex}:\`, {
                                        id: btn.id,
                                        text: btn.textContent,
                                        className: btn.className,
                                        display: getComputedStyle(btn).display,
                                        visibility: getComputedStyle(btn).visibility
                                    });
                                });
                                
                                // Send failure message to backend
                                vscode.postMessage({ 
                                    type: 'debug',
                                    message: \`Clear button not found on attempt \${index + 1}. Found \${allButtons.length} buttons total.\`,
                                    timestamp: new Date().toISOString()
                                });
                            }

                            // Only setup chat input on first successful attempt
                            if (index === 0) {
                                const chatInput = document.getElementById('chatInput');
                                const sendBtn = document.getElementById('sendBtn');

                                if (chatInput && sendBtn) {
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
                                    console.log('✅ Chat input event listeners attached');
                                } else {
                                    console.error('❌ Chat input elements not found!');
                                }
                            }
                        }, delay);
                    });
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

                function clearChat(event) {
                    console.log('🗑️ Clear chat button clicked');
                    console.log('🔍 Event details:', event);
                    
                    // Prevent any default behavior or event bubbling
                    if (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        event.stopImmediatePropagation();
                    }
                    
                    // Send debug message to backend immediately
                    vscode.postMessage({ 
                        type: 'debug',
                        message: 'clearChat function called - click event reached the function!',
                        timestamp: new Date().toISOString()
                    });
                    
                    // Add debug info about current state
                    console.log('Current chat state:', {
                        currentData: currentData,
                        messageCount: currentData ? currentData.messages.length : 'unknown',
                        isProcessing: isProcessing,
                        testMode: window.testMode
                    });
                    
                    // Check if there are messages to clear
                    const hasMessages = currentData && currentData.messages && currentData.messages.length > 0;
                    
                    if (!hasMessages && !window.testMode) {
                        console.log('ℹ️ No messages to clear');
                        vscode.postMessage({ 
                            type: 'debug',
                            message: 'No messages to clear - chat is already empty',
                            timestamp: new Date().toISOString()
                        });
                        return;
                    }
                    
                    console.log('✅ Proceeding with chat clear');
                    
                    // Send debug message to backend
                    vscode.postMessage({ 
                        type: 'debug',
                        message: window.testMode ? 'Test mode clear proceeding' : 'Clear proceeding without confirmation',
                        timestamp: new Date().toISOString()
                    });
                    
                    // Show loading state
                    const clearBtn = document.getElementById('clearBtn');
                    if (clearBtn) {
                        clearBtn.textContent = '⏳';
                        clearBtn.disabled = true;
                        clearBtn.title = 'Clearing chat...';
                        console.log('🔄 Clear button state updated to loading');
                    }
                    
                    // Immediately show empty state for better UX
                    console.log('🚀 Immediately showing empty state for better UX');
                    forceEmptyState();
                    
                    // Send clear message to backend
                    console.log('📤 Sending clearChat message to backend');
                    vscode.postMessage({ 
                        type: 'clearChat',
                        timestamp: new Date().toISOString()
                    });
                    
                    // Fallback mechanism - ensure button is reset after 3 seconds
                    setTimeout(() => {
                        console.log('🔄 Fallback mechanism triggered - ensuring button reset');
                        if (clearBtn) {
                            clearBtn.textContent = '🗑️';
                            clearBtn.disabled = false;
                            clearBtn.title = 'Clear Chat';
                            console.log('✅ Fallback button reset completed');
                        }
                    }, 3000);
                }

                // Make clearChat globally accessible for debugging
                window.clearChat = clearChat;

                function retryMessage() {
                    vscode.postMessage({ type: 'retryMessage' });
                }

                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    console.log('📨 Received message from backend:', message.type, message);
                    
                    switch (message.type) {
                        case 'updateChat':
                            console.log('🔄 Processing updateChat with', message.data.messages.length, 'messages');
                            updateChatDisplay(message.data);
                            break;
                            
                        case 'chatCleared':
                            console.log('✅ Received chatCleared confirmation');
                            // Force immediate UI update to empty state
                            forceEmptyState();
                            // Reset clear button
                            const clearBtn = document.getElementById('clearBtn');
                            if (clearBtn) {
                                clearBtn.textContent = '🗑️';
                                clearBtn.disabled = false;
                                clearBtn.title = 'Clear Chat';
                                console.log('✅ Clear button reset');
                            }
                            break;
                            
                        default:
                            console.log('⚠️ Unknown message type from backend:', message.type);
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
                    console.log('🔄 updateMessages called with', messages.length, 'messages');
                    const chatMessages = document.getElementById('chatMessages');
                    
                    if (messages.length === 0) {
                        console.log('📭 No messages, showing empty state');
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
                    console.log('✅ Messages updated, DOM innerHTML set');
                }

                function forceEmptyState() {
                    console.log('🔄 forceEmptyState called - forcing UI to empty state');
                    const chatMessages = document.getElementById('chatMessages');
                    if (chatMessages) {
                        chatMessages.innerHTML = \`
                            <div class="empty-state">
                                <h3>🤖 AI Assistant Ready</h3>
                                <p>Ask me anything about your code, or use the quick actions above!</p>
                            </div>
                        \`;
                        console.log('✅ Empty state forced');
                    } else {
                        console.error('❌ chatMessages element not found!');
                    }
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
    dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
        this.lmStudioServer.removeAllListeners();
    }
}
exports.ChatViewProvider = ChatViewProvider;
ChatViewProvider.viewType = 'ruv-swarm.chat';
//# sourceMappingURL=chatViewProvider.js.map