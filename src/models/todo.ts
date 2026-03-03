/**
 * Represents the lifecycle status of a Todo task.
 */
export type TodoStatus = "pending" | "inProgress" | "done";

/**
 * Immutable value object representing a single Todo task.
 * All mutations return a new instance — original objects are never modified.
 */
export interface Todo {
  /** Unique identifier (UUID v4). */
  readonly id: string;
  /** Human-readable description of the task. */
  readonly description: string;
  /** Current lifecycle status. */
  readonly status: TodoStatus;
  /** ISO-8601 creation timestamp. */
  readonly createdAt: string;
  /** ISO-8601 timestamp of the last update. */
  readonly updatedAt: string;
  /** Accumulated spent time in milliseconds (not counting the currently running segment). */
  readonly spentTime: number;
  /** ISO-8601 timestamp when the current inProgress timer segment started. Absent when not running. */
  readonly timerStartedAt?: string;
}

/**
 * Creates a brand-new Todo with status 'pending'.
 */
export function createTodo(description: string): Todo {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    description: description.trim(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    spentTime: 0,
  };
}

/**
 * Returns a copy of the given Todo with the supplied partial overrides applied.
 */
export function updateTodo(
  todo: Todo,
  changes: Partial<
    Pick<
      Todo,
      "description" | "status" | "updatedAt" | "spentTime" | "timerStartedAt"
    >
  >,
): Todo {
  return { ...todo, ...changes };
}

/**
 * Returns total spent time in milliseconds, including the currently running
 * inProgress segment (if any).
 */
export function getTotalSpentTime(todo: Todo): number {
  if (todo.status === "inProgress" && todo.timerStartedAt) {
    return (
      todo.spentTime + (Date.now() - new Date(todo.timerStartedAt).getTime())
    );
  }
  return todo.spentTime;
}

/**
 * Formats a millisecond duration as "Xd Xh Xm" (days/hours/minutes).
 * Seconds are intentionally omitted.
 */
export function formatSpentTime(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }
  const totalMinutes = Math.floor(ms / 60_000);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }
  return parts.join(" ");
}
