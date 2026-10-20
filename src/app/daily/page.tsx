"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CategoryPicker } from "@/components/CategoryPicker";
import { resolveCategoryStyle } from "@/lib/category";
import { effectiveStatus, isDoneToday } from "@/lib/recurring";
import { isUpcomingRepeat } from "@/lib/repeat";
import { useCategories } from "@/lib/useCategories";
import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

const TABS: { key: string; label: string }[] = [
  { key: "active", label: "진행 중" },
  { key: "done", label: "완료" },
  { key: "all", label: "전체" },
];

function DailyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "active";

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const { categories, createCategory, deleteCategory } = useCategories();

  function load() {
    const query = status === "all" ? "" : `?status=${status}`;
    return fetch(`/api/todos${query}`)
      .then((res) => res.json())
      .then((data) => {
        // Weeks of 🔁 repeat copies ahead belong on the calendar, not here.
        setTodos(data.filter((t: Todo) => !isUpcomingRepeat(t, dateKey())));
        setLoading(false);
      });
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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

  // 🔁 templates are never checked off themselves — each copy placed on the
  // calendar has its own status (see src/lib/recurring.ts).
  const countable = todos.filter((t) => !t.isRecurring);
  const doneCount = countable.filter(isDoneToday).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-bold text-ink">일간 목표</h1>

      <form onSubmit={createStandaloneTodo} className="flex flex-col gap-1">
        <div className="flex items-start gap-2">
          <input
            className="flex-1 rounded-sm border border-hairline bg-canvas px-3 py-2 text-ink focus:border-2 focus:border-ink focus:outline-none"
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

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/daily?status=${tab.key}`)}
            className={`rounded-sm px-3 py-1.5 text-sm ${
              status === tab.key
                ? "bg-primary font-medium text-on-primary"
                : "border border-hairline text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-body-text">불러오는 중...</p>
      ) : (
        <>
          {countable.length > 0 && (
            <p className="text-sm text-muted">
              {doneCount} / {countable.length} 완료
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {todos.map((todo) => {
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
                    <span
                      className={`flex-1 ${
                        done ? "text-emerald-700 line-through dark:text-emerald-400" : "text-ink"
                      }`}
                    >
                      {todo.title}
                    </span>
                    <span
                      className={`text-xs ${
                        done ? "text-emerald-600 dark:text-emerald-400" : "text-muted"
                      }`}
                    >
                      {todo.isRecurring ? "반복" : effectiveStatus(todo)}
                    </span>
                  </Link>
                </li>
              );
            })}
            {todos.length === 0 && (
              <p className="text-sm text-muted">표시할 일간 목표가 없습니다.</p>
            )}
          </ul>
        </>
      )}
    </main>
  );
}

export default function DailyPage() {
  return (
    <Suspense fallback={<main className="p-8 text-body-text">불러오는 중...</main>}>
      <DailyPageContent />
    </Suspense>
  );
}
