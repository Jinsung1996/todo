"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

  useEffect(() => {
    setLoading(true);
    const query = status === "all" ? "" : `?status=${status}`;
    fetch(`/api/todos${query}`)
      .then((res) => res.json())
      .then((data) => {
        setTodos(data);
        setLoading(false);
      });
  }, [status]);

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

  const doneCount = todos.filter((t) => t.status === "DONE").length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">할 일</h1>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => router.push(`/daily?status=${tab.key}`)}
            className={`rounded px-3 py-1.5 text-sm ${
              status === tab.key
                ? "bg-foreground text-background font-medium"
                : "border border-black/[.1] dark:border-white/[.145]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <>
          {todos.length > 0 && (
            <p className="text-sm text-zinc-500">
              {doneCount} / {todos.length} 완료
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {todos.map((todo) => {
              const done = todo.status === "DONE";
              return (
                <li key={todo._id}>
                  <Link
                    href={`/todos/${todo._id}`}
                    className={`flex items-center gap-3 rounded border px-4 py-3 hover:border-black/[.3] dark:hover:border-white/[.4] ${
                      done
                        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                        : "border-black/[.1] dark:border-white/[.145]"
                    }`}
                  >
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
                    <span
                      className={`flex-1 ${
                        done ? "text-emerald-700 line-through dark:text-emerald-400" : ""
                      }`}
                    >
                      {todo.title}
                    </span>
                    <span
                      className={`text-xs ${
                        done ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      {todo.status}
                    </span>
                  </Link>
                </li>
              );
            })}
            {todos.length === 0 && (
              <p className="text-sm text-zinc-500">표시할 할일이 없습니다.</p>
            )}
          </ul>
        </>
      )}
    </main>
  );
}

export default function DailyPage() {
  return (
    <Suspense fallback={<main className="p-8">불러오는 중...</main>}>
      <DailyPageContent />
    </Suspense>
  );
}
