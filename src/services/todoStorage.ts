import * as vscode from "vscode";
import { Todo, TodoStatus, createTodo, updateTodo } from "../models/todo.js";

/** Ensures todos loaded from an older version of the extension have all fields. */
function migrateTodo(
  raw: Partial<Todo> &
    Pick<Todo, "id" | "description" | "status" | "createdAt">,
): Todo {
  return {
    updatedAt: raw.createdAt,
    spentTime: 0,
    ...raw,
  } as Todo;
}

const STORAGE_KEY = "mytodolist.todos";

/**
 * Thin persistence layer backed by VS Code's `globalState` (key-value store
 * that survives extension restarts and is scoped to the user's machine).
 *
 * All write methods immediately flush to `globalState` and emit `onDidChange`
 * so that any subscriber (e.g. the tree view) can react to mutations.
 */
export class TodoStorage {
  private _todos: Todo[] = [];

  /** Interval duration used by the status-bar tick (ms). */
  static readonly TICK_INTERVAL_MS = 5 * 60_000; // 5 minutes
  /** A gap larger than this between two ticks is treated as a sleep period. */
  private static readonly SLEEP_THRESHOLD_MS = TodoStorage.TICK_INTERVAL_MS * 2;

  /** Wall-clock time of the last heartbeat received from the status-bar tick. */
  private _lastTickAt: number | undefined;

  /** Fires whenever the underlying list changes. */
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly globalState: vscode.Memento) {
    const raw = globalState.get<Todo[]>(STORAGE_KEY, []);
    // Migrate todos from older versions that lack the new time-tracking fields.
    this._todos = raw.map((t) => migrateTodo(t as never));
  }

  // ─── Queries ────────────────────────────────────────────────────────────────

  getAll(): ReadonlyArray<Todo> {
    return this._todos;
  }

  getById(id: string): Todo | undefined {
    return this._todos.find((t) => t.id === id);
  }

  getInProgress(): Todo | undefined {
    return this._todos.find((t) => t.status === "inProgress");
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  add(description: string): Todo {
    const todo = createTodo(description);
    this._todos = [...this._todos, todo];
    this._persist();
    return todo;
  }

  updateDescription(id: string, description: string): void {
    const now = new Date().toISOString();
    this._applyChange(id, (t) =>
      updateTodo(t, { description: description.trim(), updatedAt: now }),
    );
  }

  setStatus(id: string, status: TodoStatus): void {
    const now = new Date().toISOString();

    // If another task is currently in-progress, stop its timer first.
    if (status === "inProgress") {
      this._todos = this._todos.map((t) => {
        if (t.status !== "inProgress" || t.id === id) {
          return t;
        }
        const elapsed = t.timerStartedAt
          ? this._computeElapsed(t.timerStartedAt)
          : 0;
        return updateTodo(t, {
          status: "pending",
          spentTime: t.spentTime + elapsed,
          timerStartedAt: undefined,
          updatedAt: now,
        });
      });
    }

    this._applyChange(id, (t) => {
      const wasInProgress = t.status === "inProgress";
      const elapsed =
        wasInProgress && t.timerStartedAt
          ? this._computeElapsed(t.timerStartedAt)
          : 0;

      const timerChanges =
        status === "inProgress"
          ? { timerStartedAt: now }
          : wasInProgress
            ? { spentTime: t.spentTime + elapsed, timerStartedAt: undefined }
            : {};

      return updateTodo(t, { status, updatedAt: now, ...timerChanges });
    });
  }

  delete(id: string): void {
    this._todos = this._todos.filter((t) => t.id !== id);
    this._persist();
  }

  clearDone(): void {
    this._todos = this._todos.filter((t) => t.status !== "done");
    this._persist();
  }

  /**
   * Called by the status-bar tick so the storage knows the machine is awake.
   * Must be called at every tick interval so sleep gaps can be detected.
   */
  notifyTick(now: number): void {
    this._lastTickAt = now;
  }

  /** Manually fire a change event (e.g. for a forced UI refresh). */
  refresh(): void {
    this._onDidChange.fire();
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Computes the elapsed milliseconds since `timerStartedAt`, excluding any
   * sleep gap detected via the last known tick timestamp.
   *
   * - If the gap between the last tick and now exceeds SLEEP_THRESHOLD_MS
   *   (2 × tick interval = 10 min), the machine was likely asleep.
   * - The excess over one tick interval is subtracted as sleep time.
   */
  private _computeElapsed(timerStartedAt: string): number {
    const now = Date.now();
    const raw = now - new Date(timerStartedAt).getTime();
    if (this._lastTickAt !== undefined) {
      const gapSinceLastTick = now - this._lastTickAt;
      if (gapSinceLastTick > TodoStorage.SLEEP_THRESHOLD_MS) {
        const sleepDuration = gapSinceLastTick - TodoStorage.TICK_INTERVAL_MS;
        return Math.max(0, raw - sleepDuration);
      }
    }
    return Math.max(0, raw);
  }

  private _applyChange(id: string, fn: (t: Todo) => Todo): void {
    this._todos = this._todos.map((t) => (t.id === id ? fn(t) : t));
    this._persist();
  }

  private _persist(): void {
    this.globalState.update(STORAGE_KEY, this._todos).then(
      () => this._onDidChange.fire(),
      () => this._onDidChange.fire(), // still notify so UI stays consistent
    );
  }
}
