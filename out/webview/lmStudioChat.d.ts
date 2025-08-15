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
export declare class LMStudioChat implements vscode.Disposable {
    private context;
    private lmStudioServer;
    private swarmManager;
    private chatPanel?;
    private chatHistory;
    private outputChannel;
    private isProcessing;
    constructor(context: vscode.ExtensionContext, lmStudioServer: LMStudioServer, swarmManager: SwarmManager);
    showChat(): Promise<void>;
    private handleWebviewMessage;
    private handleUserMessage;
    private sendToLMStudio;
    private simulateLMStudioResponse;
    private getWorkspaceContext;
    private clearChat;
    private exportChat;
    private checkConnection;
    private retryLastMessage;
    private updateChatUI;
    private generateMessageId;
    private setupEventListeners;
    private generateChatHTML;
    dispose(): void;
}
//# sourceMappingURL=lmStudioChat.d.ts.map