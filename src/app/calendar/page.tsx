"use client";

import { useEffect, useState } from "react";
import { DayBoard } from "@/components/DayBoard";
import { dateKey, startOfWeek } from "@/lib/week";
import type { Todo, TodoStatus } from "@/types";

const DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(dateKey());
  const [allTodos, setAllTodos] = useState<Todo[]>([]);
  const [dayTodos, setDayTodos] = useState<Todo[]>([]);
  const [pickerTodoId, setPickerTodoId] = useState("");
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  async function loadAll() {
    const res = await fetch("/api/todos");
    setAllTodos(await res.json());
  }

  async function loadDay(date: string) {
    const res = await fetch(`/api/todos?scheduledDate=${date}`);
    setDayTodos(await res.json());
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAll(), loadDay(selectedDate)]).then(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate]);

  function countFor(date: string): number {
    return allTodos.filter((t) => t.scheduledDate === date).length;
  }

  async function assignToDay() {
    if (!pickerTodoId) return;
    await fetch(`/api/todos/${pickerTodoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: selectedDate }),
    });
    setPickerTodoId("");
    await Promise.all([loadAll(), loadDay(selectedDate)]);
  }

  async function unassign(todoId: string) {
    await fetch(`/api/todos/${todoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate: null }),
    });
    await Promise.all([loadAll(), loadDay(selectedDate)]);
  }

  async function moveStatus(todoId: string, status: TodoStatus) {
    const previous = dayTodos;
    setDayTodos((prev) =>
      prev.map((t) => (t._id === todoId ? { ...t, status } : t))
    );
    try {
      const res = await fetch(`/api/todos/${todoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("move failed");
    } catch {
      setDayTodos(previous);
    } finally {
      loadAll();
    }
  }

  const selectedLabel = `${weekDays[0].getFullYear()}.${weekDays[0].getMonth() + 1}.${weekDays[0].getDate()} ~ ${weekDays[6].getMonth() + 1}.${weekDays[6].getDate()}`;

  // Candidates for the picker: any todo, annotated with its current schedule so
  // re-assigning (moving it from another day) is an informed choice, not a surprise.
  const pickerOptions = allTodos.map((t) => {
    const suffix =
      t.scheduledDate === selectedDate
        ? " (이미 이 날)"
        : t.scheduledDate
          ? ` (${t.scheduledDate} 배정됨)`
          : "";
    return { id: t._id, label: `${t.title}${suffix}` };
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">캘린더</h1>
        <p className="text-sm text-muted">
          날짜를 클릭해 그날의 할일을 정하고, 완료한 일은 끌어다 놓으세요.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => w - 1)}
          className="rounded-sm px-2 py-1 text-sm text-muted hover:bg-surface-soft"
        >
          ← 이전 주
        </button>
        <span className="text-sm text-muted">{selectedLabel}</span>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="rounded-sm px-2 py-1 text-sm text-muted hover:bg-surface-soft"
        >
          다음 주 →
        </button>
      </div>

      <div className="flex justify-between gap-2">
        {weekDays.map((date, i) => {
          const key = dateKey(date);
          const isSelected = key === selectedDate;
          const isToday = key === dateKey();
          const count = countFor(key);
          return (
            <button
              key={key}
              onClick={() => setSelectedDate(key)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-md border px-2 py-3 text-sm transition-colors ${
                isSelected
                  ? "border-primary bg-primary text-on-primary"
                  : "border-hairline text-ink hover:bg-surface-soft"
              } ${isToday && !isSelected ? "ring-2 ring-primary" : ""}`}
            >
              <span className="text-xs opacity-80">{DAY_LABELS[i]}</span>
              <span className="font-medium">{date.getDate()}</span>
              {count > 0 && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSelected ? "bg-on-primary" : "bg-primary"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <select
          className="flex-1 rounded-sm border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus:border-2 focus:border-ink focus:outline-none"
          value={pickerTodoId}
          onChange={(e) => setPickerTodoId(e.target.value)}
        >
          <option value="">이 날에 추가할 할일 선택...</option>
          {pickerOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={assignToDay}
          disabled={!pickerTodoId}
          className="rounded-sm bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary-active disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {loading ? (
        <p className="text-body-text">불러오는 중...</p>
      ) : (
        <DayBoard todos={dayTodos} onMove={moveStatus} onUnassign={unassign} />
      )}
    </main>
  );
}
