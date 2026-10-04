"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import type { WeeklyPlan, YearlyGoal } from "@/types";

export default function WeeksPage() {
  const [weeks, setWeeks] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/weeks")
      .then((res) => res.json())
      .then((data) => {
        setWeeks(data);
        setLoading(false);
      });
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">주간 계획</h1>

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {weeks.map((week) => {
            const goal = week.yearlyGoalId as YearlyGoal;
            const goalId = typeof goal === "string" ? goal : goal._id;
            return (
              <li key={week._id}>
                <Link
                  href={`/goals/${goalId}/weeks/${week._id}`}
                  className="flex flex-col gap-2 rounded border border-black/[.1] px-4 py-3 hover:border-black/[.3] dark:border-white/[.145] dark:hover:border-white/[.4]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{week.title}</span>
                    <span className="text-sm text-zinc-500">
                      {typeof goal === "string" ? "" : goal.title}
                    </span>
                  </div>
                  <ProgressBar percent={week.progress ?? 0} />
                </Link>
              </li>
            );
          })}
          {weeks.length === 0 && (
            <p className="text-sm text-zinc-500">아직 등록된 주간계획이 없습니다.</p>
          )}
        </ul>
      )}
    </main>
  );
}
