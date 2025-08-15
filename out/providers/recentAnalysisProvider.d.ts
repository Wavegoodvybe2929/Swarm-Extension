import * as vscode from 'vscode';
import { SwarmManager } from '../utils/swarmManager';
import { Task, AnalysisResult } from '../types';
export declare class RecentAnalysisProvider implements vscode.TreeDataProvider<AnalysisItem> {
    private swarmManager;
    private _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<AnalysisItem | undefined | null | void>;
    constructor(swarmManager: SwarmManager);
    refresh(): void;
    getTreeItem(element: AnalysisItem): vscode.TreeItem;
    getChildren(element?: AnalysisItem): Promise<AnalysisItem[]>;
    private getTaskIcon;
    private getPriorityIcon;
}
declare class AnalysisItem extends vscode.TreeItem {
    readonly label: string;
    readonly collapsibleState: vscode.TreeItemCollapsibleState;
    readonly category: string;
    readonly task?: Task | undefined;
    readonly analysis?: AnalysisResult | undefined;
    readonly iconName?: string | undefined;
    constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, category: string, task?: Task | undefined, analysis?: AnalysisResult | undefined, iconName?: string | undefined);
    private getTooltip;
}
export {};
//# sourceMappingURL=recentAnalysisProvider.d.ts.map