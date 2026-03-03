import * as vscode from "vscode";
import { TodoStorage } from "./services/todoStorage.js";
import { TodoTreeProvider } from "./providers/todoTreeProvider.js";
import { TodoStatusBar } from "./statusBar/todoStatusBar.js";
import { registerCommands } from "./commands/todoCommands.js";

/**
 * Extension entry point.
 *
 * VS Code calls `activate` once when the extension is first used (the
 * `activationEvents` field in package.json controls exactly when that is —
 * we use `onStartupFinished` so that the extension is ready as soon as the
 * editor finishes loading, without blocking startup).
 */
export function activate(context: vscode.ExtensionContext): void {
  // 1. Persistent storage — backed by VS Code's globalState.
  const storage = new TodoStorage(context.globalState);

  // 2. Tree view registered in the "mytodolist" Activity Bar container.
  const treeProvider = new TodoTreeProvider(storage);
  const treeView = vscode.window.createTreeView("mytodolist.todoView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // 3. Status Bar item showing the currently in-progress task.
  const statusBar = new TodoStatusBar(storage);

  // 4. All commands (add, edit, delete, set status, clear done, refresh).
  registerCommands(context, storage);

  // 5. Register disposables so VS Code cleans up on deactivation.
  context.subscriptions.push(treeView, statusBar);
}

/**
 * VS Code calls `deactivate` when the extension is unloaded.
 * Resources registered via `context.subscriptions` are disposed automatically;
 * nothing extra is needed here.
 */
export function deactivate(): void {
  /* no-op */
}
