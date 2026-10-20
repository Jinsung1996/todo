"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotepadCard } from "@/components/NotepadCard";
import { ProgressBar } from "@/components/ProgressBar";
import { StatCard } from "@/components/StatCard";
import { TodayAgenda } from "@/components/TodayAgenda";
import { MobileDay } from "@/components/MobileDay";
import { PlannerCalendar } from "@/components/PlannerCalendar";
import { weeklyProgress } from "@/lib/progress";
import { isActiveToday } from "@/lib/recurring";
import { useCategories } from "@/lib/useCategories";
import { useIsMobile } from "@/lib/useIsMobile";
import { useTodos } from "@/lib/useTodos";
import type { WeeklyPlan, YearlyGoal } from "@/types";

function isThisWeek(week: WeeklyPlan): boolean {
  const now = Date.now();
  return new Date(week.weekStart).getTime() <= now && now <= new Date(week.weekEnd).getTime();
}

export default function DashboardPage() {
  const [goals, setGoals] = useState<YearlyGoal[]>([]);
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const {
    todos,
    loading: todosLoading,
    moveTodo,
    setStatus,
    resizeTodo,
    unassign,
    assignToDay,
    copyTodo,
    repeatTodo,
    stopRepeat,
    createOnDate,
  } = useTodos();
  const { categories } = useCategories();
  const isMobile = useIsMobile();

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

  // A phone gets just the day at hand — see src/components/MobileDay.tsx.
  if (isMobile) {
    return (
      <main className="flex flex-1 flex-col p-3">
        <MobileDay
          todos={todos}
          categories={categories}
          onMoveTodo={moveTodo}
          onSetStatus={setStatus}
          onResizeTodo={resizeTodo}
          onUnassign={unassign}
          onCopyTodo={copyTodo}
          onRepeatTodo={repeatTodo}
          onStopRepeat={stopRepeat}
          onCreateOnDate={createOnDate}
        />
      </main>
    );
  }

  const thisWeekPlans = weeks.filter(isThisWeek);
  const todayCount = todos.filter(isActiveToday).length;
  const completionPercent = weeklyProgress(todos);
  const recentGoals = goals.slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <NotepadCard label="연간 목표" value={goals.length}>
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

        <NotepadCard label="주간 목표" value={thisWeekPlans.length}>
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

        <StatCard href="/daily" label="오늘 일간 목표 수" value={todayCount} />
        <StatCard href="/daily?status=done" label="완료(%)" value={completionPercent} suffix="%" />
      </div>

      <div className="flex flex-1 items-stretch gap-3">
        {/* No overflow wrapper here: the calendar's header row is
            position: sticky against the page scroll, which any scrolling
            ancestor would break. */}
        <section className="flex min-w-0 flex-1 flex-col rounded-md border border-hairline p-3">
          <PlannerCalendar
            todos={todos}
            categories={categories}
            onMoveTodo={moveTodo}
            onSetStatus={setStatus}
            onResizeTodo={resizeTodo}
            onUnassign={unassign}
            onScheduleTodo={assignToDay}
            onCopyTodo={copyTodo}
            onRepeatTodo={repeatTodo}
            onStopRepeat={stopRepeat}
            onCreateOnDate={createOnDate}
          />
        </section>
        <TodayAgenda date={new Date()} todos={todos} />
      </div>
    </main>
  );
}
