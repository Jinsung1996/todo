"use client";

import { useCallback, useEffect, useState } from "react";
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

  const toggleDone = useCallback(
    (todoId: string, done: boolean) =>
      patchTodo(todoId, { status: done ? "DONE" : "TODO" }, (t) => ({
        ...t,
        status: (done ? "DONE" : "TODO") as TodoStatus,
      })),
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

  return { todos, loading, reload, moveTodo, toggleDone, unassign, assignToDay };
}
