"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotepadCard } from "@/components/NotepadCard";
import { ProgressBar } from "@/components/ProgressBar";
import { StatCard } from "@/components/StatCard";
import { WeekCalendar } from "@/components/WeekCalendar";
import { weeklyProgress } from "@/lib/progress";
import { useTodos } from "@/lib/useTodos";
import { dateKey, startOfWeek } from "@/lib/week";
import type { WeeklyPlan, YearlyGoal } from "@/types";

function isThisWeek(week: WeeklyPlan): boolean {
  const now = Date.now();
  return new Date(week.weekStart).getTime() <= now && now <= new Date(week.weekEnd).getTime();
}

export default function DashboardPage() {
  const [goals, setGoals] = useState<YearlyGoal[]>([]);
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const { todos, loading: todosLoading, moveTodo, toggleDone, unassign } = useTodos();

  useEffect(() => {
    Promise.all([
      fetch("/api/goals").then((res) => res.json()),
      fetch("/api/weeks").then((res) => res.json()),
    ]).then(([goalsData, weeksData]) => {
      setGoals(goalsData);
      setWeeks(weeksData);
      setGoalsLoading(false);
    });
  }, []);

  if (goalsLoading || todosLoading) {
    return <main className="p-8 text-body-text">불러오는 중...</main>;
  }

  const today = dateKey();
  const thisWeekPlans = weeks.filter(isThisWeek);
  const todayCount = todos.filter((t) => t.scheduledDate === today).length;
  const completionPercent = weeklyProgress(todos);
  const recentGoals = goals.slice(0, 5);

  const weekStart = startOfWeek(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const weekKeys = weekDays.map((d) => dateKey(d));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <p className="text-sm text-muted">
        1년 목표 -&gt; 이번 주 계획 -&gt; 오늘의 할 일을 한 화면에서
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <NotepadCard label="1년 목표" value={goals.length}>
          {recentGoals.map((goal) => (
            <Link
              key={goal._id}
              href={`/goals/${goal._id}`}
              className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-surface-soft"
            >
              <span className="font-medium text-ink">{goal.title}</span>
              <span className="text-muted">{goal.year}</span>
            </Link>
          ))}
          {recentGoals.length === 0 && (
            <p className="text-sm text-muted">아직 등록된 목표가 없습니다.</p>
          )}
        </NotepadCard>

        <NotepadCard label="이번 주 목표" value={thisWeekPlans.length}>
          {thisWeekPlans.map((week) => {
            const goal = week.yearlyGoalId as YearlyGoal;
            const goalId = typeof goal === "string" ? goal : goal._id;
            return (
              <Link
                key={week._id}
                href={`/goals/${goalId}/weeks/${week._id}`}
                className="flex flex-col gap-1.5 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-soft"
              >
                <span className="font-medium text-ink">{week.title}</span>
                <ProgressBar percent={week.progress ?? 0} />
              </Link>
            );
          })}
          {thisWeekPlans.length === 0 && (
            <p className="text-sm text-muted">이번 주 계획이 없습니다.</p>
          )}
        </NotepadCard>

        <StatCard href="/calendar" label="오늘 할 일 수" value={todayCount} />
        <StatCard href="/daily?status=done" label="완료(%)" value={completionPercent} suffix="%" />
      </div>

      <section className="flex flex-1 flex-col gap-3 rounded-md border border-hairline p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted">이번 주 캘린더</h2>
          <Link href="/calendar" className="text-xs text-muted hover:text-primary">
            전체 보기 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <WeekCalendar
            weekDays={weekDays}
            todos={todos.filter((t) => t.scheduledDate && weekKeys.includes(t.scheduledDate))}
            onMoveTodo={moveTodo}
            onToggleDone={toggleDone}
            onUnassign={unassign}
          />
        </div>
      </section>
    </main>
  );
}
