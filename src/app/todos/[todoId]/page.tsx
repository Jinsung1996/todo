"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CategoryPicker } from "@/components/CategoryPicker";
import { isDoneToday } from "@/lib/recurring";
import { useCategories } from "@/lib/useCategories";
import { dateKey } from "@/lib/week";
import type { Todo, TodoStatus, WeeklyPlan, YearlyGoal } from "@/types";

const STATUS_LABEL: Record<TodoStatus, string> = {
  TODO: "진행 전",
  DOING: "진행 중",
  DONE: "완료",
};

export default function TodoDetailPage() {
  const { todoId } = useParams<{ todoId: string }>();
  const router = useRouter();
  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(true);
  const { categories, createCategory, deleteCategory } = useCategories();

  // One retry after a short delay — a cold serverless start or a momentary
  // DB connection hiccup can make a single request fail even though the
  // todo is really there (confirmed by hand against production: the exact
  // same request succeeded moments later with no code change). Without
  // this, that transient blip reads as "일간 목표를 찾을 수 없습니다.",
  // which looks like the data was lost.
  async function fetchTodoWithRetry(): Promise<Response | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`/api/todos/${todoId}`);
        if (res.ok || attempt === 1) return res;
      } catch {
        if (attempt === 1) return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    return null;
  }

  async function load() {
    const res = await fetchTodoWithRetry();
    if (!res || !res.ok) {
      setTodo(null);
      setLoading(false);
      return;
    }
    const data: Todo = await res.json();
    setTodo(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoId]);

  async function changeStatus(status: TodoStatus) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function changeCategory(category: string | null) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    load();
  }

  async function changeIsRecurring(nextIsRecurring: boolean) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRecurring: nextIsRecurring }),
    });
    load();
  }

  // 아침/점심/저녁 같은 매일 반복 습관: checking it off never changes `status`
  // (see src/lib/recurring.ts) — only today's completion marker moves.
  async function toggleRecurringToday(checked: boolean) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastCompletedDate: checked ? dateKey() : null }),
    });
    load();
  }

  async function deleteTodo() {
    if (!confirm("이 일간 목표를 삭제할까요?")) return;
    await fetch(`/api/todos/${todoId}`, { method: "DELETE" });
    router.back();
  }

  if (loading) return <main className="p-8 text-body-text">불러오는 중...</main>;
  if (!todo) return <main className="p-8 text-body-text">일간 목표를 찾을 수 없습니다.</main>;

  const week =
    todo.weeklyPlanId && typeof todo.weeklyPlanId !== "string" ? todo.weeklyPlanId : null;
  const goal = week && typeof week.yearlyGoalId !== "string" ? (week.yearlyGoalId as YearlyGoal) : null;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      {week && goal ? (
        <Link href={`/goals/${goal._id}/weeks/${week._id}`} className="text-sm text-muted">
          ← {goal.title} / {week.title}
        </Link>
      ) : (
        <span className="text-sm text-muted-soft">개별 일정 (목표에 속하지 않음)</span>
      )}

      <h1 className="text-2xl font-bold text-ink">
        {todo.isRecurring && "🔁 "}
        {todo.title}
      </h1>
      {todo.description && <p className="text-body-text">{todo.description}</p>}

      {todo.isRecurring ? (
        // 진행 전/진행 중은 매일 반복되는 습관에는 의미가 없어요 — 오늘 했는지
        // 안 했는지만 체크하면 되고, 체크해도 이 목록에서 사라지지 않습니다.
        <label className="flex w-fit items-center gap-2 rounded-sm border border-hairline px-4 py-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isDoneToday(todo)}
            onChange={(e) => toggleRecurringToday(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          오늘 완료
        </label>
      ) : (
        <div className="flex gap-2">
          {(["TODO", "DOING", "DONE"] as TodoStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => changeStatus(status)}
              className={`rounded-sm px-4 py-2 text-sm ${
                todo.status === status
                  ? "bg-primary font-medium text-on-primary"
                  : "border border-hairline text-ink"
              }`}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-1.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={todo.isRecurring ?? false}
          onChange={(e) => changeIsRecurring(e.target.checked)}
          className="h-3.5 w-3.5 accent-primary"
        />
        매일 반복 (체크해도 목록에서 사라지지 않고 다음 날 다시 체크할 수 있어요)
      </label>

      <div className="flex items-start gap-2 text-sm text-muted">
        분류
        <CategoryPicker
          categories={categories}
          value={todo.category ?? ""}
          onChange={(value) => changeCategory(value || null)}
          onCreate={createCategory}
          onDelete={deleteCategory}
        />
      </div>

      <button onClick={deleteTodo} className="self-start text-sm text-error hover:text-error-hover">
        삭제
      </button>
    </main>
  );
}
