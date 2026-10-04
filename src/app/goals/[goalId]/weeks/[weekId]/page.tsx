"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Board } from "@/components/Board";
import { ProgressBar } from "@/components/ProgressBar";
import { weeklyProgress } from "@/lib/progress";
import type { Todo, TodoStatus, WeeklyPlan } from "@/types";

export default function WeekBoardPage() {
  const { goalId, weekId } = useParams<{ goalId: string; weekId: string }>();
  const [week, setWeek] = useState<WeeklyPlan | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [weekRes, todosRes] = await Promise.all([
      fetch(`/api/goals/${goalId}/weeks/${weekId}`),
      fetch(`/api/weeks/${weekId}/todos`),
    ]);
    if (!weekRes.ok) {
      setWeek(null);
      setLoading(false);
      return;
    }
    setWeek(await weekRes.json());
    setTodos(todosRes.ok ? await todosRes.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [weekId]);

  async function createTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch(`/api/weeks/${weekId}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    setTitle("");
    load();
  }

  async function moveTodo(todoId: string, newStatus: TodoStatus) {
    let previousStatus: TodoStatus | undefined;
    setTodos((prev) =>
      prev.map((t) => {
        if (t._id !== todoId) return t;
        previousStatus = t.status;
        return { ...t, status: newStatus };
      })
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
          prev.map((t) => (t._id === todoId ? { ...t, status: previousStatus! } : t))
        );
      }
    }
  }

  async function deleteTodo(todoId: string) {
    const snapshot = todos.find((t) => t._id === todoId);
    setTodos((prev) => prev.filter((t) => t._id !== todoId));

    try {
      const res = await fetch(`/api/todos/${todoId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
    } catch {
      if (snapshot) {
        setTodos((prev) => [...prev, snapshot]);
      }
    }
  }

  if (loading) return <main className="p-8 text-body-text">불러오는 중...</main>;
  if (!week) return <main className="p-8 text-body-text">주간계획을 찾을 수 없습니다.</main>;

  const progress = weeklyProgress(todos);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href={`/goals/${goalId}`} className="text-sm text-muted">
          ← 목표로 돌아가기
        </Link>
        <h1 className="text-2xl font-bold text-ink">{week.title}</h1>
      </div>

      <ProgressBar percent={progress} />

      <form onSubmit={createTodo} className="flex gap-2">
        <input
          className="flex-1 rounded-sm border border-hairline bg-canvas px-3 py-2 text-ink focus:border-2 focus:border-ink focus:outline-none"
          placeholder="할일 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-sm bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary-active"
        >
          추가
        </button>
      </form>

      <Board todos={todos} onMove={moveTodo} onDelete={deleteTodo} />
    </main>
  );
}
