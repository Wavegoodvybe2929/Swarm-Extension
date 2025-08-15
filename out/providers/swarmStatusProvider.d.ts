import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { SwarmStatus } from '../types';
export declare class SwarmStatusProvider implements vscode.TreeDataProvider<SwarmStatusItem> {
    private swarmManager;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<SwarmStatusItem | undefined | null | void>;
    constructor(swarmManager: SwarmManager);
    refresh(): void;
    getTreeItem(element: SwarmStatusItem): vscode.TreeItem;
    getChildren(element?: SwarmStatusItem): Promise<SwarmStatusItem[]>;
    private getChildItems;
    private getHealthIcon;
}
declare class SwarmStatusItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly category: string;
    readonly status: SwarmStatus;
    readonly iconName?: string | undefined;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, category: string, status: SwarmStatus, iconName?: string | undefined);
    private getTooltip;
}
export {};
//# sourceMappingURL=swarmStatusProvider.d.ts.map