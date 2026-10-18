import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

type StatusFields = Pick<Todo, "status" | "isRecurring" | "lastCompletedDate">;
type PlacementFields = Pick<Todo, "scheduledDate" | "startTime" | "isRecurring">;

/**
 * Whether `todo` is checked off for *today* specifically. A non-recurring
 * todo just uses its stored status; a recurring one (아침/점심/저녁 등) never
 * actually becomes DONE in storage — see src/lib/useTodos.ts's
 * toggleRecurringToday — so "done" has to be derived from whether it was
 * last completed today.
 */
export function isDoneToday(todo: StatusFields): boolean {
  if (todo.isRecurring) return todo.lastCompletedDate === dateKey();
  return todo.status === "DONE";
}

/**
 * The status to *display*. A recurring todo's real `status` field is left
 * at TODO forever; what the UI shows instead is whether it's been checked
 * off today, so completing it never makes it disappear from the active
 * list — tomorrow it's simply unchecked again, with nothing to re-create.
 */
export function effectiveStatus(todo: StatusFields): TodoStatus {
  if (todo.isRecurring) return isDoneToday(todo) ? "DONE" : "TODO";
  return todo.status;
}

/**
 * Once a recurring todo has been dragged onto the calendar at least once
 * (it has a startTime), it stays pinned to *today*'s column every day after
 * that — rather than requiring a fresh drag each morning, which is exactly
 * the hassle this feature exists to remove. A non-recurring todo just
 * checks its literal scheduledDate.
 */
export function isActiveToday(todo: PlacementFields): boolean {
  if (!todo.scheduledDate || !todo.startTime) return false;
  if (todo.isRecurring) return true;
  return todo.scheduledDate === dateKey();
}
