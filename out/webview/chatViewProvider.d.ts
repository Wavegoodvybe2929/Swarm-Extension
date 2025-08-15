import * as vscode from 'vscode';
import { LMStudioServer } from '../mcp/servers/lmStudioServer';
import { SwarmManager } from '../utils/swarmManager';
export declare class ChatViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    static readonly viewType = "ruv-swarm.chat";
    private _view?;
    private context;
    private lmStudioServer;
    private swarmManager;
    private chatHistory;
    private isProcessing;
    private outputChannel;
    constructor(context: vscode.ExtensionContext, lmStudioServer: LMStudioServer, swarmManager: SwarmManager);
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, _token: vscode.CancellationToken): void;
    private handleMessage;
    private handleUserMessage;
    private handleQuickAction;
    private getCurrentContext;
    private sendToLMStudio;
    private buildSystemPrompt;
    private simulateLMStudioResponse;
    private clearChat;
    private checkConnection;
    private retryLastMessage;
    private updateChatUI;
    private loadChatHistory;
    private saveChatHistory;
    private generateMessageId;
    private setupEventListeners;
    private getHtmlForWebview;
    dispose(): void;
}
//# sourceMappingURL=chatViewProvider.d.ts.map