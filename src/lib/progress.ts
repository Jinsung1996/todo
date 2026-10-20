import { isUpcomingRepeat } from "@/lib/repeat";
import { dateKey } from "@/lib/week";

type ProgressTodo = { status: string; repeatSourceId?: unknown; scheduledDate?: string | null };

export function weeklyProgress(todos: ProgressTodo[], today: string = dateKey()): number {
  const counted = todos.filter((t) => !isUpcomingRepeat(t, today));
  if (counted.length === 0) return 0;
  const done = counted.filter((t) => t.status === "DONE").length;
  return Math.round((done / counted.length) * 100);
}
