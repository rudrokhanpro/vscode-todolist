import * as vscode from "vscode";
import {
  Todo,
  TodoStatus,
  getTotalSpentTime,
  formatSpentTime,
} from "../models/todo.js";
import { TodoStorage } from "../services/todoStorage.js";

// ─── TreeItem ────────────────────────────────────────────────────────────────

/**
 * A single row in the Task tree view.
 * `contextValue` is used by package.json `when` clauses to conditionally show
 * the correct inline actions for each status.
 */
export class TodoTreeItem extends vscode.TreeItem {
  constructor(readonly todo: Todo) {
    super(todo.description, vscode.TreeItemCollapsibleState.None);

    this.id = todo.id;
    this.contextValue = statusToContextValue(todo.status);
    this.tooltip = buildTooltip(todo);
    this.iconPath = new vscode.ThemeIcon(
      statusToIcon(todo.status),
      statusToColor(todo.status),
    );
    this.description = buildDescription(todo);

    // Clicking the item opens the edit dialog.
    this.command = {
      command: "mytodolist.editTodo",
      title: "Edit Task",
      arguments: [this],
    };
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Provides the data for the "Tasks" tree view rendered in the Activity Bar.
 * Tasks are grouped into three collapsible sections: In Progress, Pending, Done.
 */
export class TodoTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly storage: TodoStorage) {
    storage.onDidChange(() => this._onDidChangeTreeData.fire());
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    // Root level → return the three group headers.
    if (!element) {
      return this._buildGroups();
    }

    // Group level → return the tasks that belong to this group.
    if (element instanceof GroupTreeItem) {
      return this.storage
        .getAll()
        .filter((t) => t.status === element.status)
        .map((t) => new TodoTreeItem(t));
    }

    return [];
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private _buildGroups(): GroupTreeItem[] {
    const all = this.storage.getAll();
    const count = (status: TodoStatus): number =>
      all.filter((t) => t.status === status).length;

    return [
      new GroupTreeItem("inProgress", `In Progress (${count("inProgress")})`),
      new GroupTreeItem("pending", `Pending (${count("pending")})`),
      new GroupTreeItem("done", `Done (${count("done")})`),
    ];
  }
}

// ─── Group header item ────────────────────────────────────────────────────────

class GroupTreeItem extends vscode.TreeItem {
  constructor(
    readonly status: TodoStatus,
    label: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = `group_${status}`;
    this.iconPath = new vscode.ThemeIcon(groupIcon(status));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusToContextValue(status: TodoStatus): string {
  // Must match the `when` clause values declared in package.json.
  const map: Record<TodoStatus, string> = {
    pending: "pending",
    inProgress: "inProgress",
    done: "done",
  };
  return map[status];
}

function statusToIcon(status: TodoStatus): string {
  const map: Record<TodoStatus, string> = {
    pending: "circle-outline",
    inProgress: "play-circle",
    done: "pass-filled",
  };
  return map[status];
}

function statusToColor(status: TodoStatus): vscode.ThemeColor {
  const map: Record<TodoStatus, string> = {
    pending: "charts.yellow",
    inProgress: "charts.blue",
    done: "charts.green",
  };
  return new vscode.ThemeColor(map[status]);
}

function groupIcon(status: TodoStatus): string {
  const map: Record<TodoStatus, string> = {
    pending: "list-unordered",
    inProgress: "zap",
    done: "checklist",
  };
  return map[status];
}

function buildTooltip(todo: Todo): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendMarkdown(`**${todo.description}**\n\n`);
  md.appendMarkdown(`- **Status:** ${statusLabel(todo.status)}\n`);
  md.appendMarkdown(
    `- **Created:** ${new Date(todo.createdAt).toLocaleString()}\n`,
  );
  md.appendMarkdown(
    `- **Updated:** ${new Date(todo.updatedAt).toLocaleString()}\n`,
  );
  const total = getTotalSpentTime(todo);
  if (total > 0 || todo.status === "inProgress") {
    md.appendMarkdown(`- **Time spent:** ${formatSpentTime(total)}`);
    if (todo.status === "inProgress") {
      md.appendMarkdown(` *(running)*`);
    }
    md.appendMarkdown(`\n`);
  }
  return md;
}

function statusLabel(status: TodoStatus): string {
  const map: Record<TodoStatus, string> = {
    pending: "Pending",
    inProgress: "In Progress",
    done: "Done",
  };
  return map[status];
}

function buildDescription(todo: Todo): string {
  const total = getTotalSpentTime(todo);
  const timeStr = total > 0 ? formatSpentTime(total) : undefined;

  if (todo.status === "inProgress" && timeStr) {
    return `⏱ ${timeStr}`;
  }
  if (todo.status !== "inProgress" && timeStr) {
    return `${formatDate(todo.createdAt)} · ${timeStr}`;
  }
  return formatDate(todo.createdAt);
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
