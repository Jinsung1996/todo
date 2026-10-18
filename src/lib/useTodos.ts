"use client";

import { useCallback, useEffect, useState } from "react";
import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

/**
 * Shared fetch + optimistic-PATCH logic for the week calendar (dashboard's
 * embedded view and the full /calendar page both schedule/reschedule todos
 * the same way).
 */
export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch("/api/todos");
    setTodos(await res.json());
  }, []);

  useEffect(() => {
    // `loading` already starts true, so this effect only needs to flip it
    // off once the initial fetch resolves (no synchronous setState here).
    reload().then(() => setLoading(false));
  }, [reload]);

  const patchTodo = useCallback(
    async (todoId: string, body: Record<string, unknown>, apply: (t: Todo) => Todo) => {
      let previous: Todo[] = [];
      setTodos((prev) => {
        previous = prev;
        return prev.map((t) => (t._id === todoId ? apply(t) : t));
      });
      try {
        const res = await fetch(`/api/todos/${todoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("patch failed");
        const updated: Todo = await res.json();
        setTodos((prev) => prev.map((t) => (t._id === todoId ? updated : t)));
      } catch {
        setTodos(previous);
      }
    },
    []
  );

  const moveTodo = useCallback(
    (todoId: string, newDate: string, newStartTime: string) =>
      patchTodo(todoId, { scheduledDate: newDate, startTime: newStartTime }, (t) => ({
        ...t,
        scheduledDate: newDate,
        startTime: newStartTime,
      })),
    [patchTodo]
  );

  // 진행 전/진행 중/완료 is always an explicit pick (a select in the
  // calendar, buttons on the detail page) — nothing here ever flips a
  // 진행 중 item to 완료 on its own.
  const setStatus = useCallback(
    (todoId: string, status: TodoStatus) =>
      patchTodo(todoId, { status }, (t) => ({ ...t, status })),
    [patchTodo]
  );

  // 30-minute increments, driven by dragging the calendar block's bottom
  // edge — the block's height on the grid is derived straight from
  // durationMinutes, so this is the only thing that needs to change to
  // grow/shrink it visually.
  const resizeTodo = useCallback(
    (todoId: string, durationMinutes: number) =>
      patchTodo(todoId, { durationMinutes }, (t) => ({ ...t, durationMinutes })),
    [patchTodo]
  );

  // Checking off a recurring todo (아침/점심/저녁 등) for today never touches
  // `status` — it only ever stores *today's* date here, or clears it back
  // to null. See src/lib/recurring.ts for how that gets turned into a
  // DONE/TODO display and why tomorrow it's unchecked again with nothing to
  // re-create.
  const toggleRecurringToday = useCallback(
    (todoId: string, checked: boolean) => {
      const value = checked ? dateKey() : null;
      return patchTodo(todoId, { lastCompletedDate: value }, (t) => ({
        ...t,
        lastCompletedDate: value,
      }));
    },
    [patchTodo]
  );

  const unassign = useCallback(
    (todoId: string) =>
      patchTodo(todoId, { scheduledDate: null, startTime: null }, (t) => ({
        ...t,
        scheduledDate: null,
        startTime: null,
      })),
    [patchTodo]
  );

  // scheduledDate only — the server auto-fills the next open time slot.
  const assignToDay = useCallback(
    (todoId: string, date: string) =>
      patchTodo(todoId, { scheduledDate: date }, (t) => ({ ...t, scheduledDate: date })),
    [patchTodo]
  );

  return {
    todos,
    loading,
    reload,
    moveTodo,
    setStatus,
    resizeTodo,
    toggleRecurringToday,
    unassign,
    assignToDay,
  };
}
