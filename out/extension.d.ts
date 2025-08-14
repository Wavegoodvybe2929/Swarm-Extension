import * as vscode from 'vscode';
import { SwarmManager } from './utils/swarmManager';
import { CommandManager } from './commands/commandManager';
import { DiagnosticsProvider } from './providers/diagnosticsProvider';
import { StatusBarManager } from './utils/statusBarManager';
import { FileWatcher } from './utils/fileWatcher';
import { WebviewProvider } from './webview/webviewProvider';
declare let swarmManager: SwarmManager;
declare let commandManager: CommandManager;
declare let diagnosticsProvider: DiagnosticsProvider;
declare let statusBarManager: StatusBarManager;
declare let fileWatcher: FileWatcher;
declare let webviewProvider: WebviewProvider;
export declare function activate(context: vscode.ExtensionContext): Promise<void>;
export declare function deactivate(): void;
export { swarmManager, commandManager, diagnosticsProvider, statusBarManager, fileWatcher, webviewProvider };
//# sourceMappingURL=extension.d.ts.map