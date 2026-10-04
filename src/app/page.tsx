"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import type { Todo, WeeklyPlan, YearlyGoal } from "@/types";

function isThisWeek(week: WeeklyPlan): boolean {
  const now = Date.now();
  return new Date(week.weekStart).getTime() <= now && now <= new Date(week.weekEnd).getTime();
}

export default function DashboardPage() {
  const [goals, setGoals] = useState<YearlyGoal[]>([]);
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/goals").then((res) => res.json()),
      fetch("/api/weeks").then((res) => res.json()),
      fetch("/api/todos").then((res) => res.json()),
    ]).then(([goalsData, weeksData, todosData]) => {
      setGoals(goalsData);
      setWeeks(weeksData);
      setTodos(todosData);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <main className="p-8 text-body-text">불러오는 중...</main>;
  }

  const thisWeekCount = weeks.filter(isThisWeek).length;
  const doneCount = todos.filter((t) => t.status === "DONE").length;
  const activeTodos = todos.filter((t) => t.status !== "DONE").slice(0, 5);
  const recentGoals = goals.slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-8">
      <p className="text-sm text-muted">
        1년 목표 -&gt; 이번 주 계획 -&gt; 오늘의 할 일을 한 화면에서
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard href="/goals" label="1년 목표" value={goals.length} />
        <StatCard href="/weeks" label="이번 주 목표" value={thisWeekCount} />
        <StatCard href="/daily" label="총 할 일" value={todos.length} />
        <StatCard href="/daily?status=done" label="완료" value={doneCount} />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">1년 목표</h2>
        <ul className="flex flex-col gap-2">
          {recentGoals.map((goal) => (
            <li key={goal._id}>
              <Link
                href={`/goals/${goal._id}`}
                className="flex items-center justify-between rounded-md border border-hairline px-4 py-3 text-sm transition-shadow hover:shadow-elevated"
              >
                <span className="font-medium text-ink">{goal.title}</span>
                <span className="text-muted">{goal.year}</span>
              </Link>
            </li>
          ))}
          {recentGoals.length === 0 && (
            <p className="text-sm text-muted">아직 등록된 목표가 없습니다.</p>
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">오늘의 할 일</h2>
        <ul className="flex flex-col gap-2">
          {activeTodos.map((todo) => (
            <li key={todo._id}>
              <Link
                href={`/todos/${todo._id}`}
                className="flex items-center justify-between rounded-md border border-hairline px-4 py-3 text-sm transition-shadow hover:shadow-elevated"
              >
                <span className="text-ink">{todo.title}</span>
                <span className="text-xs text-muted">{todo.status}</span>
              </Link>
            </li>
          ))}
          {activeTodos.length === 0 && (
            <p className="text-sm text-muted">완료하지 않은 할일이 없습니다.</p>
          )}
        </ul>
      </section>
    </main>
  );
}
