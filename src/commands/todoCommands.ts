import * as vscode from "vscode";
import { TodoStorage } from "../services/todoStorage.js";
import { TodoTreeItem } from "../providers/todoTreeProvider.js";
import { Todo } from "../models/todo.js";

/**
 * Registers all commands contributed by the extension and returns a disposable
 * that deregisters them on extension deactivation.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  storage: TodoStorage,
): vscode.Disposable {
  const disposables: vscode.Disposable[] = [
    vscode.commands.registerCommand("mytodolist.addTodo", () =>
      cmdAddTodo(storage),
    ),
    vscode.commands.registerCommand(
      "mytodolist.editTodo",
      (item?: TodoTreeItem) => cmdEditTodo(storage, item),
    ),
    vscode.commands.registerCommand(
      "mytodolist.deleteTodo",
      (item?: TodoTreeItem) => cmdDeleteTodo(storage, item),
    ),
    vscode.commands.registerCommand(
      "mytodolist.setInProgress",
      (item?: TodoTreeItem) => cmdSetStatus(storage, item, "inProgress"),
    ),
    vscode.commands.registerCommand(
      "mytodolist.markDone",
      (item?: TodoTreeItem) => cmdSetStatus(storage, item, "done"),
    ),
    vscode.commands.registerCommand(
      "mytodolist.markPending",
      (item?: TodoTreeItem) => cmdSetStatus(storage, item, "pending"),
    ),
    vscode.commands.registerCommand("mytodolist.clearDone", () =>
      cmdClearDone(storage),
    ),
    vscode.commands.registerCommand("mytodolist.refresh", () =>
      cmdRefresh(storage),
    ),
  ];

  context.subscriptions.push(...disposables);
  return vscode.Disposable.from(...disposables);
}

// ─── Command implementations ─────────────────────────────────────────────────

async function cmdAddTodo(storage: TodoStorage): Promise<void> {
  const description = await vscode.window.showInputBox({
    title: "Add Task",
    prompt: "Enter a description for your new task",
    placeHolder: "e.g. Implement the login screen",
    validateInput: validateDescription,
  });

  if (description === undefined) {
    return;
  } // user cancelled
  storage.add(description);
}

async function cmdEditTodo(
  storage: TodoStorage,
  item?: TodoTreeItem,
): Promise<void> {
  const todo = await resolveTodo(storage, item);
  if (!todo) {
    return;
  }

  const description = await vscode.window.showInputBox({
    title: "Edit Task",
    prompt: "Update the task description",
    value: todo.description,
    validateInput: validateDescription,
  });

  if (description === undefined) {
    return;
  } // user cancelled
  storage.updateDescription(todo.id, description);
}

async function cmdDeleteTodo(
  storage: TodoStorage,
  item?: TodoTreeItem,
): Promise<void> {
  const todo = await resolveTodo(storage, item);
  if (!todo) {
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `Delete task "${todo.description}"?`,
    { modal: true },
    "Delete",
  );

  if (answer === "Delete") {
    storage.delete(todo.id);
  }
}

async function cmdSetStatus(
  storage: TodoStorage,
  item: TodoTreeItem | undefined,
  status: "inProgress" | "done" | "pending",
): Promise<void> {
  const todo = await resolveTodo(storage, item);
  if (!todo) {
    return;
  }
  storage.setStatus(todo.id, status);
}

function cmdRefresh(storage: TodoStorage): void {
  storage.refresh();
}

async function cmdClearDone(storage: TodoStorage): Promise<void> {
  const doneCount = storage.getAll().filter((t) => t.status === "done").length;
  if (doneCount === 0) {
    vscode.window.showInformationMessage("No completed tasks to clear.");
    return;
  }

  const answer = await vscode.window.showWarningMessage(
    `Remove all ${doneCount} completed task(s)?`,
    { modal: true },
    "Clear",
  );

  if (answer === "Clear") {
    storage.clearDone();
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolves the target Todo either from the tree-item argument (inline/context
 * menu invocation) or via a quick-pick (when triggered from the command palette).
 */
async function resolveTodo(
  storage: TodoStorage,
  item?: TodoTreeItem,
): Promise<Todo | undefined> {
  if (item?.todo) {
    return item.todo;
  }

  const todos = storage.getAll();
  if (todos.length === 0) {
    vscode.window.showInformationMessage("No tasks found. Add one first.");
    return undefined;
  }

  const picks = todos.map((t) => ({
    label: t.description,
    description: t.status,
    detail: `Created ${new Date(t.createdAt).toLocaleString()}`,
    todo: t,
  }));

  const selected = await vscode.window.showQuickPick(picks, {
    title: "Select a task",
    matchOnDescription: true,
  });

  return selected?.todo;
}

function validateDescription(value: string): string | undefined {
  if (!value.trim()) {
    return "Description cannot be empty.";
  }
  if (value.trim().length > 200) {
    return "Description must be 200 characters or fewer.";
  }
  return undefined;
}
