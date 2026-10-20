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

  // Another occurrence of `todoId` on `date` (오전 공부 + 오후 공부, or a
  // 🔁 반복 일정 dragged onto the day it's needed) — the server copies it;
  // without `startTime` it auto-fills the next open slot.
  const copyTodo = useCallback(
    async (todoId: string, date: string, startTime?: string, durationMinutes?: number) => {
      const res = await fetch(`/api/todos/${todoId}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: date, startTime, durationMinutes }),
      });
      if (!res.ok) {
        alert("일정을 추가하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      const created: Todo = await res.json();
      setTodos((prev) => [...prev, created]);
    },
    []
  );

  // A 🔁 template placed on `date` and, from then on, on every one of
  // `weekdays` at the same time (see src/app/api/todos/[todoId]/repeat).
  // Reloads rather than merging: the template's rule and dozens of copies
  // all change at once.
  const repeatTodo = useCallback(
    async (
      todoId: string,
      date: string,
      weekdays: number[],
      startTime?: string,
      durationMinutes?: number
    ) => {
      const res = await fetch(`/api/todos/${todoId}/repeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: date, startTime, durationMinutes, weekdays }),
      });
      if (!res.ok) {
        alert("반복 일정을 추가하지 못했어요. 다시 시도해 주세요.");
        return;
      }
      await reload();
    },
    [reload]
  );

  // "이후 반복 일정 모두": a running rule's time/length/days, from `from` on.
  const updateRepeat = useCallback(
    async (
      templateId: string,
      from: string,
      changes: { startTime?: string; durationMinutes?: number; weekdays?: number[] }
    ) => {
      const res = await fetch(`/api/todos/${templateId}/repeat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, ...changes }),
      });
      if (!res.ok) {
        alert("반복 일정을 바꾸지 못했어요. 다시 시도해 주세요.");
      }
      await reload();
    },
    [reload]
  );

  // Today's copy stays; the untouched ones after it go.
  const stopRepeat = useCallback(
    async (todoId: string) => {
      const res = await fetch(`/api/todos/${todoId}/repeat?after=${dateKey()}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("반복을 멈추지 못했어요. 다시 시도해 주세요.");
        return;
      }
      await reload();
    },
    [reload]
  );

  // A brand-new standalone 일간 목표 entered straight onto a day (the month
  // calendar's per-day "+"), e.g. an appointment months ahead.
  const createOnDate = useCallback(async (title: string, date: string) => {
    const res = await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, scheduledDate: date }),
    });
    if (!res.ok) {
      alert(`"${title}" 일정을 추가하지 못했어요. 다시 시도해 주세요.`);
      return;
    }
    const created: Todo = await res.json();
    setTodos((prev) => [...prev, created]);
  }, []);

  return {
    todos,
    loading,
    reload,
    moveTodo,
    setStatus,
    resizeTodo,
    unassign,
    assignToDay,
    copyTodo,
    repeatTodo,
    updateRepeat,
    stopRepeat,
    createOnDate,
  };
}
