import * as vscode from "vscode";
import { TodoStorage } from "../services/todoStorage.js";
import { getTotalSpentTime, formatSpentTime } from "../models/todo.js";
// TodoStorage.TICK_INTERVAL_MS is re-used here so both stay in sync.

/**
 * Manages the Status Bar item that shows the currently in-progress task.
 *
 * Clicking the item opens the MyTodoList panel so the user can quickly
 * switch to the activity bar view.
 *
 * A one-minute interval keeps the elapsed time display up-to-date while a
 * task is running, without requiring any storage mutations.
 */
export class TodoStatusBar implements vscode.Disposable {
  private readonly _item: vscode.StatusBarItem;
  private readonly _subscription: vscode.Disposable;
  private _tickTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private readonly storage: TodoStorage) {
    this._item = vscode.window.createStatusBarItem(
      "mytodolist.statusBar",
      vscode.StatusBarAlignment.Left,
      -1,
    );
    this._item.name = "MyTodoList – Current Task";
    this._item.command = "workbench.view.extension.mytodolist";

    // Perform an initial render and react to every subsequent change.
    this._render();
    this._subscription = storage.onDidChange(() => {
      this._render();
      this._syncTimer();
    });
    this._syncTimer();
  }

  dispose(): void {
    this._clearTimer();
    this._subscription.dispose();
    this._item.dispose();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  /** Start or stop the live-update interval based on whether a task is running. */
  private _syncTimer(): void {
    const inProgress = this.storage.getInProgress();
    if (inProgress?.timerStartedAt) {
      if (!this._tickTimer) {
        // Tick every 5 minutes. Each tick also notifies storage so it can
        // detect sleep gaps (a gap > 2× the interval means the machine slept).
        this._tickTimer = setInterval(() => {
          this.storage.notifyTick(Date.now());
          this._render();
        }, TodoStorage.TICK_INTERVAL_MS);
      }
    } else {
      this._clearTimer();
    }
  }

  private _clearTimer(): void {
    if (this._tickTimer !== undefined) {
      clearInterval(this._tickTimer);
      this._tickTimer = undefined;
    }
  }

  private _render(): void {
    const inProgress = this.storage.getInProgress();

    if (inProgress) {
      const short =
        inProgress.description.length > 40
          ? `${inProgress.description.slice(0, 37)}…`
          : inProgress.description;

      const elapsed = getTotalSpentTime(inProgress);
      const timeStr = elapsed > 0 ? ` · ${formatSpentTime(elapsed)}` : "";

      this._item.text = `$(play-circle) ${short}${timeStr}`;
      this._item.tooltip = new vscode.MarkdownString(
        `**MyTodoList – In Progress**\n\n${inProgress.description}\n\n⏱ **Time spent:** ${formatSpentTime(elapsed)} *(running)*`,
      );
      this._item.backgroundColor = undefined;
      this._item.show();
    } else {
      this._item.text = "$(circle-outline) No task in progress";
      this._item.tooltip = "MyTodoList – Click to open task panel";
      this._item.backgroundColor = undefined;
      this._item.show();
    }
  }
}
