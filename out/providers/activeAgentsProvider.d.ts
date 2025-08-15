import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { Agent } from '../types';
export declare class ActiveAgentsProvider implements vscode.TreeDataProvider<AgentItem> {
    private swarmManager;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<AgentItem | undefined | null | void>;
    constructor(swarmManager: SwarmManager);
    refresh(): void;
    getTreeItem(element: AgentItem): vscode.TreeItem;
    getChildren(element?: AgentItem): Promise<AgentItem[]>;
    private getAgentIcon;
}
declare class AgentItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly category: string;
    readonly agent?: Agent | undefined;
    readonly iconName?: string | undefined;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, category: string, agent?: Agent | undefined, iconName?: string | undefined);
    private getTooltip;
}
export {};
//# sourceMappingURL=activeAgentsProvider.d.ts.map