import { isUpcomingRepeat } from "@/lib/repeat";
import { dateKey } from "@/lib/week";
import type { Todo } from "@/types";

type ProgressTodo = { status: string; repeatSourceId?: unknown; scheduledDate?: string | null };

export function weeklyProgress(todos: ProgressTodo[], today: string = dateKey()): number {
  const counted = todos.filter((t) => !isUpcomingRepeat(t, today));
  if (counted.length === 0) return 0;
  const done = counted.filter((t) => t.status === "DONE").length;
  return Math.round((done / counted.length) * 100);
}

type DayTodo = Pick<Todo, "status" | "isRecurring" | "scheduledDate" | "startTime">;

/** The todos placed on `day`'s calendar column, earliest first. */
export function todosOnDay<T extends DayTodo>(todos: T[], day: string): T[] {
  return todos
    .filter((t) => !t.isRecurring && t.scheduledDate === day && t.startTime)
    .sort((a, b) => a.startTime!.localeCompare(b.startTime!));
}

/**
 * 완료(%) for one day — only what's on that day's calendar counts, so
 * yesterday's plans never drag today's rate down.
 */
export function dailyProgress(todos: DayTodo[], day: string = dateKey()): number {
  const placed = todosOnDay(todos, day);
  if (placed.length === 0) return 0;
  return Math.round((placed.filter((t) => t.status === "DONE").length / placed.length) * 100);
}
