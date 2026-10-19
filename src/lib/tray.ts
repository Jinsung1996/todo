import type { Todo } from "@/types";

function weeklyPlanKey(todo: Todo): string | null {
  const plan = todo.weeklyPlanId;
  if (!plan) return null;
  return typeof plan === "string" ? plan : plan._id;
}

// Lower is preferred as the chip that stands in for its group: a recurring
// template first (dropping it always places a fresh copy), then a copy not
// yet on any day (dropping it places that one itself), then anything else.
function rank(todo: Todo): number {
  if (todo.isRecurring) return 0;
  if (!todo.scheduledDate) return 1;
  return 2;
}

/**
 * The chips shown in the calendar's "끌어서 일정에 추가" tray: one per
 * distinct 일간 목표 (same title + category + 주간 목표), so placing 공부
 * three times in a day doesn't leave three identical 공부 chips behind.
 * Finished one-off todos drop out; recurring templates always stay.
 */
export function trayTodos(todos: Todo[]): Todo[] {
  const groups = new Map<string, Todo>();
  for (const todo of todos) {
    if (!todo.isRecurring && todo.status === "DONE") continue;
    const key = JSON.stringify([todo.title, todo.category ?? null, weeklyPlanKey(todo)]);
    const current = groups.get(key);
    if (!current || rank(todo) < rank(current)) groups.set(key, todo);
  }
  return [...groups.values()];
}

/**
 * Dropping a chip either places that very todo (it's not on any day yet) or
 * places another occurrence of it — a recurring template, or something
 * already on the calendar that's being added again (오전 공부, 오후 공부).
 */
export function dropPlacesCopy(todo: Todo): boolean {
  return Boolean(todo.isRecurring || todo.scheduledDate);
}
