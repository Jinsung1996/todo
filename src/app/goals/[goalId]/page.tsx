"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { WeeklyPlan, YearlyGoal } from "@/types";

export default function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const [goal, setGoal] = useState<YearlyGoal | null>(null);
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [title, setTitle] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [goalRes, weeksRes] = await Promise.all([
      fetch(`/api/goals/${goalId}`),
      fetch(`/api/goals/${goalId}/weeks`),
    ]);
    if (!goalRes.ok) {
      setGoal(null);
      setLoading(false);
      return;
    }
    setGoal(await goalRes.json());
    setWeeks(weeksRes.ok ? await weeksRes.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [goalId]);

  async function createWeek(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !weekStart || !weekEnd) return;
    await fetch(`/api/goals/${goalId}/weeks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, weekStart, weekEnd }),
    });
    setTitle("");
    setWeekStart("");
    setWeekEnd("");
    load();
  }

  async function deleteWeek(id: string) {
    if (!confirm("이 주간계획과 하위 할일이 모두 삭제됩니다. 계속할까요?")) {
      return;
    }
    await fetch(`/api/goals/${goalId}/weeks/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <main className="p-8">불러오는 중...</main>;
  if (!goal) return <main className="p-8">목표를 찾을 수 없습니다.</main>;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div>
        <Link href="/goals" className="text-sm text-zinc-500">
          ← 목표 목록
        </Link>
        <h1 className="text-2xl font-semibold">
          {goal.title} <span className="text-zinc-500">({goal.year})</span>
        </h1>
      </div>

      <form onSubmit={createWeek} className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded border border-black/[.1] px-3 py-2 dark:border-white/[.145]"
          placeholder="주간계획 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="date"
          className="rounded border border-black/[.1] px-3 py-2 dark:border-white/[.145]"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
        />
        <input
          type="date"
          className="rounded border border-black/[.1] px-3 py-2 dark:border-white/[.145]"
          value={weekEnd}
          onChange={(e) => setWeekEnd(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          추가
        </button>
      </form>

      <ul className="flex flex-col gap-2">
        {weeks.map((week) => (
          <li
            key={week._id}
            className="flex items-center justify-between rounded border border-black/[.1] px-4 py-3 dark:border-white/[.145]"
          >
            <Link href={`/goals/${goalId}/weeks/${week._id}`} className="flex-1">
              {week.title}
            </Link>
            <button
              onClick={() => deleteWeek(week._id)}
              className="text-sm text-red-600"
            >
              삭제
            </button>
          </li>
        ))}
        {weeks.length === 0 && (
          <p className="text-sm text-zinc-500">아직 등록된 주간계획이 없습니다.</p>
        )}
      </ul>
    </main>
  );
}
