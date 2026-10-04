"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Todo, TodoStatus, WeeklyPlan, YearlyGoal } from "@/types";

const STATUS_LABEL: Record<TodoStatus, string> = {
  TODO: "할 일",
  DOING: "진행 중",
  DONE: "완료",
};

export default function TodoDetailPage() {
  const { todoId } = useParams<{ todoId: string }>();
  const router = useRouter();
  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`/api/todos/${todoId}`);
    if (!res.ok) {
      setTodo(null);
      setLoading(false);
      return;
    }
    setTodo(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [todoId]);

  async function changeStatus(status: TodoStatus) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function deleteTodo() {
    if (!confirm("이 할일을 삭제할까요?")) return;
    await fetch(`/api/todos/${todoId}`, { method: "DELETE" });
    router.back();
  }

  if (loading) return <main className="p-8">불러오는 중...</main>;
  if (!todo) return <main className="p-8">할일을 찾을 수 없습니다.</main>;

  const week = typeof todo.weeklyPlanId === "string" ? null : todo.weeklyPlanId;
  const goal = week && typeof week.yearlyGoalId !== "string" ? (week.yearlyGoalId as YearlyGoal) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      {week && goal && (
        <Link
          href={`/goals/${goal._id}/weeks/${week._id}`}
          className="text-sm text-zinc-500"
        >
          ← {goal.title} / {week.title}
        </Link>
      )}

      <h1 className="text-2xl font-semibold">{todo.title}</h1>
      {todo.description && <p className="text-zinc-600 dark:text-zinc-400">{todo.description}</p>}

      <div className="flex gap-2">
        {(["TODO", "DOING", "DONE"] as TodoStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => changeStatus(status)}
            className={`rounded px-4 py-2 text-sm ${
              todo.status === status
                ? "bg-foreground text-background font-medium"
                : "border border-black/[.1] dark:border-white/[.145]"
            }`}
          >
            {STATUS_LABEL[status]}
          </button>
        ))}
      </div>

      <button onClick={deleteTodo} className="self-start text-sm text-red-600">
        삭제
      </button>
    </main>
  );
}
