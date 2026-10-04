"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { YearlyGoal } from "@/types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<YearlyGoal[]>([]);
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    const res = await fetch("/api/goals");
    setGoals(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, year }),
    });
    setTitle("");
    load();
  }

  async function deleteGoal(id: string) {
    if (!confirm("이 목표와 하위 주간계획/할일이 모두 삭제됩니다. 계속할까요?")) {
      return;
    }
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    load();
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === goals.length ? new Set() : new Set(goals.map((g) => g._id))
    );
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (
      !confirm(
        `선택한 ${selected.size}개의 목표와 하위 주간계획/할일이 모두 삭제됩니다. 계속할까요?`
      )
    ) {
      return;
    }
    await Promise.all(
      Array.from(selected).map((id) => fetch(`/api/goals/${id}`, { method: "DELETE" }))
    );
    setSelected(new Set());
    setSelectMode(false);
    load();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">연간 목표</h1>
        {goals.length > 0 && (
          <button
            onClick={toggleSelectMode}
            className="text-sm text-zinc-500 hover:underline"
          >
            {selectMode ? "취소" : "여러 개 삭제"}
          </button>
        )}
      </div>

      <form onSubmit={createGoal} className="flex gap-2">
        <input
          className="flex-1 rounded border border-black/[.1] px-3 py-2 dark:border-white/[.145]"
          placeholder="목표 제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="number"
          className="w-24 rounded border border-black/[.1] px-3 py-2 dark:border-white/[.145]"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        />
        <button
          type="submit"
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          추가
        </button>
      </form>

      {selectMode && (
        <div className="flex items-center justify-between rounded border border-black/[.1] px-4 py-2 text-sm dark:border-white/[.145]">
          <button onClick={toggleSelectAll} className="text-zinc-500 hover:underline">
            {selected.size === goals.length ? "전체 해제" : "전체 선택"}
          </button>
          <button
            onClick={deleteSelected}
            disabled={selected.size === 0}
            className="rounded bg-red-600 px-3 py-1.5 text-white disabled:opacity-40"
          >
            선택 삭제 ({selected.size})
          </button>
        </div>
      )}

      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {goals.map((goal) => (
            <li
              key={goal._id}
              className="flex items-center justify-between rounded border border-black/[.1] px-4 py-3 dark:border-white/[.145]"
            >
              {selectMode ? (
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(goal._id)}
                    onChange={() => toggleSelected(goal._id)}
                  />
                  <span className="font-medium">{goal.title}</span>{" "}
                  <span className="text-sm text-zinc-500">{goal.year}</span>
                </label>
              ) : (
                <>
                  <Link href={`/goals/${goal._id}`} className="flex-1">
                    <span className="font-medium">{goal.title}</span>{" "}
                    <span className="text-sm text-zinc-500">{goal.year}</span>
                  </Link>
                  <button
                    onClick={() => deleteGoal(goal._id)}
                    className="text-sm text-red-600"
                  >
                    삭제
                  </button>
                </>
              )}
            </li>
          ))}
          {goals.length === 0 && (
            <p className="text-sm text-zinc-500">아직 등록된 목표가 없습니다.</p>
          )}
        </ul>
      )}
    </main>
  );
}
