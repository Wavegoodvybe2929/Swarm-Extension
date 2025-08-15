import * as vscode from 'vscode';
import { LMStudioServer } from '../mcp/servers/lmStudioServer';
import { SwarmManager } from '../utils/swarmManager';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    toolCalls?: ToolCall[];
    metadata?: {
        model?: string;
        tokens?: number;
        responseTime?: number;
    };
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: any;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime: Date;
    endTime?: Date;
}

export class LMStudioChat implements vscode.Disposable {
    private context: vscode.ExtensionContext;
    private lmStudioServer: LMStudioServer;
    private swarmManager: SwarmManager;
    private chatPanel?: vscode.WebviewPanel;
    private chatHistory: ChatMessage[] = [];
    private outputChannel: vscode.OutputChannel;
    private isProcessing = false;

    constructor(
        context: vscode.ExtensionContext,
        lmStudioServer: LMStudioServer,
        swarmManager: SwarmManager
    ) {
        this.context = context;
        this.lmStudioServer = lmStudioServer;
        this.swarmManager = swarmManager;
        this.outputChannel = vscode.window.createOutputChannel('RUV-Swarm LM Studio Chat');
        
        this.setupEventListeners();
    }

    async showChat(): Promise<void> {
        try {
            this.outputChannel.appendLine('💬 Opening LM Studio Chat...');
            
            if (this.chatPanel) {
                this.chatPanel.reveal(vscode.ViewColumn.Two);
                return;
            }

            this.chatPanel = vscode.window.createWebviewPanel(
                'lmStudioChat',
                '🤖 LM Studio Chat',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    localResourceRoots: [this.context.extensionUri],
                    retainContextWhenHidden: true
                }
            );

            // Handle panel disposal
            this.chatPanel.onDidDispose(() => {
                this.chatPanel = undefined;
                this.outputChannel.appendLine('💬 Chat panel disposed');
            });

            // Handle messages from webview
            this.chatPanel.webview.onDidReceiveMessage(async (message) => {
                await this.handleWebviewMessage(message);
            });

            // Set initial content
            this.chatPanel.webview.html = this.generateChatHTML();
            
            // Send initial data
            await this.updateChatUI();
            
            this.outputChannel.appendLine('✅ LM Studio Chat opened successfully!');

        } catch (error) {
            this.outputChannel.appendLine(`❌ Failed to open chat: ${error}`);
            vscode.window.showErrorMessage(`Failed to open LM Studio chat: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleWebviewMessage(message: any): Promise<void> {
        try {
            this.outputChannel.appendLine(`📨 Received message: ${message.type}`);
            
            switch (message.type) {
                case 'sendMessage':
                    await this.handleUserMessage(message.content);
                    break;
                    
                case 'clearChat':
                    this.outputChannel.appendLine('🗑️ Processing clearChat request...');
                    await this.clearChat();
                    this.outputChannel.appendLine('✅ clearChat completed');
                    break;
                    
                case 'exportChat':
                    await this.exportChat();
                    break;
                    
                case 'checkConnection':
                    await this.checkConnection();
                    break;
                    
                case 'retryMessage':
                    await this.retryLastMessage();
                    break;
                    
                default:
                    this.outputChannel.appendLine(`⚠️ Unknown message type: ${message.type}`);
            }
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error handling message: ${error}`);
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

            // Send to LM Studio and get response
            const response = await this.sendToLMStudio(content);
            
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

        } catch (error) {
            this.outputChannel.appendLine(`❌ Error processing message: ${error}`);
            
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

    private async sendToLMStudio(userMessage: string): Promise<{
        content: string;
        toolCalls?: ToolCall[];
        metadata?: any;
    }> {
        const startTime = Date.now();
        
        // Get current workspace context
        const workspaceContext = await this.getWorkspaceContext();
        
        // Prepare the conversation context
        const conversationHistory = this.chatHistory.slice(-10); // Last 10 messages for context
        
        // Build the prompt with context
        const systemPrompt = `You are an AI assistant integrated with the RUV-Swarm system. You have access to powerful tools that can analyze code, generate tests, perform security scans, and more using swarm intelligence.

Available tools:
- analyze_file: Analyze files for syntax, logic, performance, or security issues
- read_file_content: Read and examine file contents
- generate_tests: Generate comprehensive unit tests
- explain_code: Provide detailed code explanations
- code_review: Perform thorough code reviews
- optimize_performance: Suggest performance improvements
- get_project_structure: Get project overview
- search_codebase: Search across the codebase
- get_swarm_status: Get real-time swarm metrics

Current workspace: ${workspaceContext.name}
Files in workspace: ${workspaceContext.fileCount}
Active file: ${workspaceContext.activeFile || 'None'}

Use these tools when appropriate to provide comprehensive assistance.`;

        // Simulate LM Studio API call (this would be replaced with actual API integration)
        const response = await this.simulateLMStudioResponse(systemPrompt, conversationHistory, userMessage);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        return {
            content: response.content,
            toolCalls: response.toolCalls,
            metadata: {
                model: 'LM Studio Model',
                tokens: response.content.length, // Simplified token count
                responseTime
            }
        };
    }

    private async simulateLMStudioResponse(systemPrompt: string, history: ChatMessage[], userMessage: string): Promise<{
        content: string;
        toolCalls?: ToolCall[];
    }> {
        // This is a simulation - in real implementation, this would call LM Studio API
        // For now, we'll detect if the user is asking for tool usage and simulate appropriate responses
        
        const toolCalls: ToolCall[] = [];
        let content = '';

        // Simple pattern matching to determine if tools should be used
        if (userMessage.toLowerCase().includes('analyze') && userMessage.toLowerCase().includes('file')) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const toolCall: ToolCall = {
                    id: this.generateMessageId(),
                    name: 'analyze_file',
                    arguments: {
                        filePath: activeEditor.document.fileName,
                        analysisType: 'all'
                    },
                    status: 'running',
                    startTime: new Date()
                };
                
                toolCalls.push(toolCall);
                
                // Execute the tool
                try {
                    const result = await this.lmStudioServer.callTool('analyze_file', toolCall.arguments);
                    toolCall.result = result;
                    toolCall.status = 'completed';
                    toolCall.endTime = new Date();
                    
                    content = `I've analyzed the file using the swarm intelligence system. Here's what I found:\n\n${JSON.stringify(result.content, null, 2)}`;
                } catch (error) {
                    toolCall.status = 'failed';
                    toolCall.endTime = new Date();
                    content = `I encountered an error while analyzing the file: ${error}`;
                }
            } else {
                content = "I'd be happy to analyze a file for you! Please open a file in the editor first, then ask me to analyze it.";
            }
        } else if (userMessage.toLowerCase().includes('generate') && userMessage.toLowerCase().includes('test')) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const toolCall: ToolCall = {
                    id: this.generateMessageId(),
                    name: 'generate_tests',
                    arguments: {
                        filePath: activeEditor.document.fileName,
                        testFramework: 'jest'
                    },
                    status: 'running',
                    startTime: new Date()
                };
                
                toolCalls.push(toolCall);
                
                try {
                    const result = await this.lmStudioServer.callTool('generate_tests', toolCall.arguments);
                    toolCall.result = result;
                    toolCall.status = 'completed';
                    toolCall.endTime = new Date();
                    
                    content = `I've generated comprehensive tests for your file using the swarm system:\n\n${JSON.stringify(result.content, null, 2)}`;
                } catch (error) {
                    toolCall.status = 'failed';
                    toolCall.endTime = new Date();
                    content = `I encountered an error while generating tests: ${error}`;
                }
            } else {
                content = "I can generate tests for you! Please open a file in the editor first, then ask me to generate tests for it.";
            }
        } else if (userMessage.toLowerCase().includes('swarm') && userMessage.toLowerCase().includes('status')) {
            const toolCall: ToolCall = {
                id: this.generateMessageId(),
                name: 'get_swarm_status',
                arguments: {
                    includeAgents: true,
                    includeMetrics: true
                },
                status: 'running',
                startTime: new Date()
            };
            
            toolCalls.push(toolCall);
            
            try {
                const result = await this.lmStudioServer.callTool('get_swarm_status', toolCall.arguments);
                toolCall.result = result;
                toolCall.status = 'completed';
                toolCall.endTime = new Date();
                
                content = `Here's the current swarm status:\n\n${JSON.stringify(result.content, null, 2)}`;
            } catch (error) {
                toolCall.status = 'failed';
                toolCall.endTime = new Date();
                content = `I encountered an error while getting swarm status: ${error}`;
            }
        } else {
            // General response without tool usage
            content = `I'm your AI assistant powered by LM Studio and integrated with the RUV-Swarm system. I can help you with:

• **Code Analysis**: Ask me to analyze files for issues, security vulnerabilities, or performance problems
• **Test Generation**: I can generate comprehensive unit tests for your code
• **Code Review**: Get detailed code reviews with suggestions for improvement
• **Performance Optimization**: Analyze and optimize your code's performance
• **Code Explanation**: Get detailed explanations of complex code sections
• **Project Understanding**: I can analyze your entire project structure

Try asking me something like:
- "Analyze the current file"
- "Generate tests for this file"
- "What's the swarm status?"
- "Explain this code"
- "Review my code for security issues"

What would you like me to help you with?`;
        }

        return { content, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
    }

    private async getWorkspaceContext(): Promise<{
        name: string;
        fileCount: number;
        activeFile?: string;
    }> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const activeEditor = vscode.window.activeTextEditor;
        
        let fileCount = 0;
        if (workspaceFolder) {
            const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
            fileCount = files.length;
        }

        return {
            name: workspaceFolder?.name || 'No workspace',
            fileCount,
            activeFile: activeEditor?.document.fileName
        };
    }

    private async clearChat(): Promise<void> {
        this.outputChannel.appendLine(`🗑️ Starting clearChat - current history length: ${this.chatHistory.length}`);
        
        try {
            // Clear the chat history
            this.chatHistory = [];
            this.outputChannel.appendLine('✅ Chat history array cleared');
            
            // Force UI update with explicit empty state
            await this.updateChatUI();
            this.outputChannel.appendLine('✅ UI update sent');
            
            // Send a confirmation message to the webview with force clear flag
            if (this.chatPanel) {
                await this.chatPanel.webview.postMessage({
                    type: 'chatCleared',
                    data: { 
                        timestamp: new Date().toISOString(),
                        forceClear: true
                    }
                });
                this.outputChannel.appendLine('✅ Chat cleared confirmation sent to webview');
                
                // Also send a direct update with empty messages
                await this.chatPanel.webview.postMessage({
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
            
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error during clearChat: ${error}`);
            vscode.window.showErrorMessage(`Failed to clear chat: ${error}`);
        }
    }

    private async exportChat(): Promise<void> {
        const chatData = {
            timestamp: new Date().toISOString(),
            messages: this.chatHistory,
            metadata: {
                totalMessages: this.chatHistory.length,
                exportedBy: 'RUV-Swarm LM Studio Chat'
            }
        };

        const chatJson = JSON.stringify(chatData, null, 2);
        
        // Show save dialog
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`lm-studio-chat-${Date.now()}.json`),
            filters: {
                'JSON Files': ['json'],
                'All Files': ['*']
            }
        });

        if (uri) {
            await vscode.workspace.fs.writeFile(uri, Buffer.from(chatJson, 'utf8'));
            vscode.window.showInformationMessage('Chat exported successfully!');
        }
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
        if (!this.chatPanel) return;

        this.chatPanel.webview.postMessage({
            type: 'updateChat',
            data: {
                messages: this.chatHistory,
                isConnected: this.lmStudioServer.isConnected,
                isProcessing: this.isProcessing,
                timestamp: new Date().toISOString()
            }
        });
    }

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private setupEventListeners(): void {
        // Listen to LM Studio server events
        this.lmStudioServer.on('connected', () => {
            this.outputChannel.appendLine('🔗 LM Studio connected');
            this.updateChatUI();
        });

        this.lmStudioServer.on('disconnected', () => {
            this.outputChannel.appendLine('🔌 LM Studio disconnected');
            this.updateChatUI();
        });
    }

    private generateChatHTML(): string {
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LM Studio Chat</title>
            <style>
                :root {
                    --primary-color: #007acc;
                    --success-color: #28a745;
                    --warning-color: #ffc107;
                    --danger-color: #dc3545;
                    --info-color: #17a2b8;
                    --border-radius: 8px;
                    --spacing: 12px;
                    --transition: all 0.2s ease;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                }

                .chat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: var(--spacing);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }

                .chat-title {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing);
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .connection-status {
                    display: flex;
                    align-items: center;
                    gap: calc(var(--spacing) / 2);
                    font-size: 12px;
                }

                .status-indicator {
                    width: 8px;
                    height: 8px;
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
                    gap: calc(var(--spacing) / 2);
                }

                .header-btn {
                    padding: 4px 8px;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 11px;
                    transition: var(--transition);
                }

                .header-btn:hover {
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
                    max-width: 80%;
                    animation: fadeIn 0.3s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .message.user {
                    align-self: flex-end;
                }

                .message.assistant {
                    align-self: flex-start;
                }

                .message.system {
                    align-self: center;
                    max-width: 90%;
                }

                .message-content {
                    padding: var(--spacing);
                    border-radius: var(--border-radius);
                    word-wrap: break-word;
                    white-space: pre-wrap;
                }

                .message.user .message-content {
                    background-color: var(--primary-color);
                    color: white;
                }

                .message.assistant .message-content {
                    background-color: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                }

                .message.system .message-content {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border: 1px solid var(--vscode-panel-border);
                    font-style: italic;
                    text-align: center;
                }

                .message-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 4px;
                    font-size: 10px;
                    color: var(--vscode-descriptionForeground);
                }

                .message-time {
                    opacity: 0.7;
                }

                .message-metadata {
                    display: flex;
                    gap: var(--spacing);
                    font-size: 10px;
                }

                .tool-calls {
                    margin-top: var(--spacing);
                    padding: var(--spacing);
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: var(--border-radius);
                    border-left: 3px solid var(--info-color);
                }

                .tool-call {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: calc(var(--spacing) / 2);
                    margin-bottom: calc(var(--spacing) / 2);
                    background-color: var(--vscode-input-background);
                    border-radius: 4px;
                    font-size: 11px;
                }

                .tool-call:last-child {
                    margin-bottom: 0;
                }

                .tool-info {
                    flex: 1;
                }

                .tool-name {
                    font-weight: 600;
                    color: var(--vscode-textLink-foreground);
                }

                .tool-args {
                    color: var(--vscode-descriptionForeground);
                    margin-top: 2px;
                }

                .tool-status {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 9px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .tool-status.pending { background-color: var(--vscode-button-secondaryBackground); }
                .tool-status.running { background-color: var(--info-color); color: white; }
                .tool-status.completed { background-color: var(--success-color); color: white; }
                .tool-status.failed { background-color: var(--danger-color); color: white; }

                .chat-input-container {
                    padding: var(--spacing);
                    border-top: 1px solid var(--vscode-panel-border);
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }

                .chat-input-wrapper {
                    display: flex;
                    gap: var(--spacing);
                    align-items: flex-end;
                }

                .chat-input {
                    flex: 1;
                    min-height: 40px;
                    max-height: 120px;
                    padding: var(--spacing);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: var(--border-radius);
                    resize: none;
                    font-family: inherit;
                    font-size: inherit;
                    line-height: 1.4;
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
                    padding: var(--spacing);
                    background-color: var(--primary-color);
                    color: white;
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-weight: 600;
                    transition: var(--transition);
                    min-width: 60px;
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
                    padding: calc(var(--spacing) * 4);
                }

                .empty-state h3 {
                    margin: 0 0 var(--spacing) 0;
                    font-size: 18px;
                }

                .empty-state p {
                    margin: 0 0 calc(var(--spacing) * 2) 0;
                    line-height: 1.5;
                    max-width: 400px;
                }

                .suggestions {
                    display: flex;
                    flex-direction: column;
                    gap: calc(var(--spacing) / 2);
                    margin-top: var(--spacing);
                }

                .suggestion {
                    padding: calc(var(--spacing) / 2) var(--spacing);
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: var(--border-radius);
                    cursor: pointer;
                    font-size: 12px;
                    transition: var(--transition);
                }

                .suggestion:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }

                .processing-indicator {
                    display: flex;
                    align-items: center;
                    gap: var(--spacing);
                    padding: var(--spacing);
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: var(--border-radius);
                    margin-bottom: var(--spacing);
                    animation: fadeIn 0.3s ease;
                }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--vscode-descriptionForeground);
                    border-top: 2px solid var(--primary-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .retry-btn {
                    margin-left: auto;
                    padding: 2px 6px;
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                    transition: var(--transition);
                }

                .retry-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="chat-header">
                <h1 class="chat-title">
                    🤖 LM Studio Chat
                </h1>
                <div class="connection-status">
                    <div id="statusIndicator" class="status-indicator"></div>
                    <span id="statusText">Disconnected</span>
                </div>
                <div class="header-actions">
                    <button id="checkConnectionBtn" class="header-btn">🔗 Check</button>
                    <button id="clearChatBtn" class="header-btn">🗑️ Clear</button>
                    <button id="exportChatBtn" class="header-btn">📤 Export</button>
                </div>
            </div>

            <div class="chat-container">
                <div id="chatMessages" class="chat-messages">
                    <div class="empty-state">
                        <h3>🤖 Welcome to LM Studio Chat!</h3>
                        <p>I'm your AI assistant powered by LM Studio and integrated with the RUV-Swarm system. I can help you analyze code, generate tests, perform reviews, and much more using swarm intelligence.</p>
                        <div class="suggestions">
                            <button class="suggestion" onclick="sendSuggestion('Analyze the current file')">🔍 Analyze the current file</button>
                            <button class="suggestion" onclick="sendSuggestion('Generate tests for this file')">🧪 Generate tests for this file</button>
                            <button class="suggestion" onclick="sendSuggestion('What\\'s the swarm status?')">📊 What's the swarm status?</button>
                            <button class="suggestion" onclick="sendSuggestion('Explain this code')">📖 Explain this code</button>
                        </div>
                    </div>
                </div>

                <div class="chat-input-container">
                    <div class="chat-input-wrapper">
                        <textarea id="chatInput" class="chat-input" placeholder="Type your message here... (Shift+Enter for new line)" rows="1"></textarea>
                        <button id="sendBtn" class="send-btn">Send</button>
                    </div>
                </div>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                let currentData = null;
                let isProcessing = false;

                // Initialize chat
                document.addEventListener('DOMContentLoaded', () => {
                    setupEventListeners();
                    requestUpdate();
                });

                function setupEventListeners() {
                    // Header buttons
                    document.getElementById('checkConnectionBtn').addEventListener('click', checkConnection);
                    document.getElementById('clearChatBtn').addEventListener('click', clearChat);
                    document.getElementById('exportChatBtn').addEventListener('click', exportChat);

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
                    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
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

                function sendSuggestion(message) {
                    const chatInput = document.getElementById('chatInput');
                    chatInput.value = message;
                    autoResizeTextarea(chatInput);
                    updateSendButton();
                    sendMessage();
                }

                function clearChat() {
                    console.log('Clear chat button clicked');
                    if (confirm('Are you sure you want to clear the chat history?')) {
                        console.log('User confirmed chat clear, sending message to backend');
                        
                        // Show loading state
                        const clearBtn = document.getElementById('clearChatBtn');
                        if (clearBtn) {
                            clearBtn.textContent = '⏳ Clearing...';
                            clearBtn.disabled = true;
                        }
                        
                        vscode.postMessage({ type: 'clearChat' });
                        
                        // Reset button after a short delay (will be updated when chat updates)
                        setTimeout(() => {
                            if (clearBtn) {
                                clearBtn.textContent = '🗑️ Clear';
                                clearBtn.disabled = false;
                            }
                        }, 1000);
                    } else {
                        console.log('User cancelled chat clear');
                    }
                }

                function exportChat() {
                    vscode.postMessage({ type: 'exportChat' });
                }

                function checkConnection() {
                    vscode.postMessage({ type: 'checkConnection' });
                }

                function retryMessage() {
                    vscode.postMessage({ type: 'retryMessage' });
                }

                function requestUpdate() {
                    // Initial update will be sent automatically
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
                        statusText.textContent = 'Connected';
                    } else {
                        statusIndicator.classList.remove('connected');
                        statusText.textContent = 'Disconnected';
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
                                <h3>🤖 Welcome to LM Studio Chat!</h3>
                                <p>I'm your AI assistant powered by LM Studio and integrated with the RUV-Swarm system. I can help you analyze code, generate tests, perform reviews, and much more using swarm intelligence.</p>
                                <div class="suggestions">
                                    <button class="suggestion" onclick="sendSuggestion('Analyze the current file')">🔍 Analyze the current file</button>
                                    <button class="suggestion" onclick="sendSuggestion('Generate tests for this file')">🧪 Generate tests for this file</button>
                                    <button class="suggestion" onclick="sendSuggestion('What\\'s the swarm status?')">📊 What's the swarm status?</button>
                                    <button class="suggestion" onclick="sendSuggestion('Explain this code')">📖 Explain this code</button>
                                </div>
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
                                            <div class="tool-args">\${JSON.stringify(tool.arguments)}</div>
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
                                \${message.metadata.model ? \`<span>Model: \${message.metadata.model}</span>\` : ''}
                                \${message.metadata.tokens ? \`<span>Tokens: \${message.metadata.tokens}</span>\` : ''}
                                \${message.metadata.responseTime ? \`<span>Time: \${message.metadata.responseTime}ms</span>\` : ''}
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
        if (this.chatPanel) {
            this.chatPanel.dispose();
        }
        this.outputChannel.dispose();
        this.lmStudioServer.removeAllListeners();
    }
}
