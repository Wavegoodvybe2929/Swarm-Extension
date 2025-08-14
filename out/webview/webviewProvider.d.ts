import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
export declare class WebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
    private context;
    private swarmManager;
    private webviewView?;
    private updateInterval?;
    constructor(context: vscode.ExtensionContext, swarmManager: SwarmManager);
    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): void | Thenable<void>;
    showDashboard(): Promise<void>;
    private handleWebviewMessage;
    private updateDashboard;
    private updateDashboardPanel;
    private sendMessageToWebview;
    private getDashboardData;
    private startPeriodicUpdates;
    private getWebviewContent;
    private getDashboardHTML;
    dispose(): void;
}
//# sourceMappingURL=webviewProvider.d.ts.map