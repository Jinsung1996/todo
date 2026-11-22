"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CategoryPicker } from "@/components/CategoryPicker";
import { resolveCategoryStyle } from "@/lib/category";
import { dailyProgress, todosOnDay } from "@/lib/progress";
import { effectiveStatus, isDoneToday } from "@/lib/recurring";
import { addDaysToKey, weekdayOfKey } from "@/lib/repeat";
import { isDateKey } from "@/lib/schedule";
import { useCategories } from "@/lib/useCategories";
import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_NAMES[weekdayOfKey(key)]})`;
}

function DailyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = dateKey();
  const dateParam = searchParams.get("date");
  const day = isDateKey(dateParam) ? dateParam : today;

  const [todos, setTodos] = useState<Todo[]>([]);
  // 날짜 미정 items already done when the list loaded — hidden so the list
  // doesn't pile up, while one checked off just now stays until reload.
  const [doneAtLoad, setDoneAtLoad] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const { categories, createCategory, deleteCategory } = useCategories();

  function load() {
    return fetch("/api/todos")
      .then((res) => res.json())
      .then((data: Todo[]) => {
        setTodos(data);
        setDoneAtLoad(new Set(data.filter((t) => t.status === "DONE").map((t) => t._id)));
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  function goToDay(key: string) {
    router.replace(key === today ? "/daily" : `/daily?date=${key}`);
  }

  // Creates a standalone 일간 목표 not tied to any 연간 목표/주간 목표 — for
  // routines (출근, 운동), appointments, or one-off events (토익 등) that
  // still need a spot on the calendar.
  async function createStandaloneTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category: category.trim() || undefined, isRecurring }),
    });
    setTitle("");
    setCategory("");
    setIsRecurring(false);
    load();
  }

  async function toggleDone(todoId: string, checked: boolean) {
    const newStatus: TodoStatus = checked ? "DONE" : "TODO";
    const previousStatus = todos.find((t) => t._id === todoId)?.status;
    setTodos((prev) =>
      prev.map((t) => (t._id === todoId ? { ...t, status: newStatus } : t))
    );

    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("patch failed");
    } catch {
      if (previousStatus) {
        setTodos((prev) =>
          prev.map((t) => (t._id === todoId ? { ...t, status: previousStatus } : t))
        );
      }
    }
  }

  const dayTodos = todosOnDay(todos, day);
  const dayDone = dayTodos.filter((t) => t.status === "DONE").length;
  // Not on any day yet: the 🔁 templates and whatever still waits in the
  // calendar tray to be dragged onto a day.
  const undated = todos.filter(
    (t) => t.isRecurring || (!t.scheduledDate && !doneAtLoad.has(t._id))
  );

  function renderTodo(todo: Todo) {
    const done = isDoneToday(todo);
    const cat = resolveCategoryStyle(todo.category, categories);
    return (
      <li key={todo._id}>
        <Link
          href={`/todos/${todo._id}`}
          className={`flex items-center gap-3 rounded-md border px-4 py-3 transition-shadow hover:shadow-elevated ${
            done
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
              : "border-hairline"
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${cat.dot}`} aria-hidden />
          {todo.isRecurring ? (
            <span className="w-4 text-center text-sm" title="반복 일정" aria-hidden>
              🔁
            </span>
          ) : (
            <input
              type="checkbox"
              checked={done}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                toggleDone(todo._id, e.target.checked);
              }}
              className="h-4 w-4 accent-emerald-600"
            />
          )}
          {todo.scheduledDate === day && todo.startTime && (
            <span className="w-11 shrink-0 text-xs tabular-nums text-muted">{todo.startTime}</span>
          )}
          <span
            className={`flex-1 ${
              done ? "text-emerald-700 line-through dark:text-emerald-400" : "text-ink"
            }`}
          >
            {todo.title}
          </span>
          <span
            className={`text-xs ${done ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}
          >
            {todo.isRecurring ? "반복" : effectiveStatus(todo)}
          </span>
        </Link>
      </li>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <h1 className="text-2xl font-bold text-ink">일간 목표</h1>

      <form onSubmit={createStandaloneTodo} className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
          <input
            className="w-full flex-1 rounded-sm sm:w-auto border border-hairline bg-canvas px-3 py-2 text-ink focus:border-2 focus:border-ink focus:outline-none"
            placeholder="일간 목표 제목 (예: 출근, 운동, 친구 약속, 토익)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <CategoryPicker
            categories={categories}
            value={category}
            onChange={setCategory}
            onCreate={createCategory}
            onDelete={deleteCategory}
          />
          <button
            type="submit"
            className="rounded-sm bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary-active"
          >
            추가
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          반복 일정 (점심식사처럼 — 캘린더 위쪽 목록에 항상 남아 있어서, 필요한 날마다 끌어다
          놓으면 그날 일정으로 하나씩 추가돼요)
        </label>
        <p className="text-xs text-muted-soft">
          연간 목표/주간 목표 없이 바로 추가하는 일정이에요. 반복 일상이나 약속처럼 목표에 속하지
          않는 일정도 캘린더에 올릴 수 있습니다.
        </p>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => goToDay(addDaysToKey(day, -1))}
          aria-label="이전 날"
          className="rounded-sm border border-hairline px-3 py-1.5 text-sm text-ink hover:bg-surface-soft"
        >
          ◀
        </button>
        <input
          type="date"
          aria-label="날짜 선택"
          value={day}
          onChange={(e) => isDateKey(e.target.value) && goToDay(e.target.value)}
          className="rounded-sm border border-hairline bg-canvas px-3 py-1.5 text-sm text-ink"
        />
        <button
          onClick={() => goToDay(addDaysToKey(day, 1))}
          aria-label="다음 날"
          className="rounded-sm border border-hairline px-3 py-1.5 text-sm text-ink hover:bg-surface-soft"
        >
          ▶
        </button>
        {day !== today && (
          <button
            onClick={() => goToDay(today)}
            className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-active"
          >
            오늘
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-body-text">불러오는 중...</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold text-ink">
                {day === today ? "오늘" : dayLabel(day)}
                {day === today && <span className="ml-2 text-sm font-normal text-muted">{dayLabel(day)}</span>}
              </h2>
              {dayTodos.length > 0 && (
                <p className="text-sm text-muted">
                  {dayDone} / {dayTodos.length} 완료 ({dailyProgress(todos, day)}%)
                </p>
              )}
            </div>
            <ul className="flex flex-col gap-2">
              {dayTodos.map(renderTodo)}
              {dayTodos.length === 0 && (
                <p className="text-sm text-muted">이 날 캘린더에 올린 일정이 없습니다.</p>
              )}
            </ul>
          </section>

          {undated.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-semibold text-ink">
                날짜 미정
                <span className="ml-2 text-sm font-normal text-muted">
                  캘린더에 아직 올리지 않은 일정이에요
                </span>
              </h2>
              <ul className="flex flex-col gap-2">{undated.map(renderTodo)}</ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export default function DailyPage() {
  return (
    <Suspense fallback={<main className="p-4 sm:p-8 text-body-text">불러오는 중...</main>}>
      <DailyPageContent />
    </Suspense>
  );
}
