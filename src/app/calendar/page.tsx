"use client";

import { useState } from "react";
import { WeekCalendar } from "@/components/WeekCalendar";
import { useTodos } from "@/lib/useTodos";
import { dateKey, startOfWeek } from "@/lib/week";

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { todos, loading, moveTodo, toggleDone, unassign, assignToDay } = useTodos();
  const [pickerTodoId, setPickerTodoId] = useState("");
  const [pickerDate, setPickerDate] = useState(dateKey());
  // Tracks the week we last defaulted pickerDate for, so switching weeks
  // resets it (without an effect — adjusted directly during render, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-state-based-on-a-prop-change).
  const [pickerWeekOffset, setPickerWeekOffset] = useState(weekOffset);

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekKeys = weekDays.map((d) => dateKey(d));

  if (weekOffset !== pickerWeekOffset) {
    setPickerWeekOffset(weekOffset);
    // Default the picker's target day to today when it's in view, otherwise
    // the week's Monday.
    setPickerDate(weekKeys.includes(dateKey()) ? dateKey() : weekKeys[0]);
  }

  const unscheduled = todos.filter((t) => !t.scheduledDate);

  async function handleAssign() {
    if (!pickerTodoId) return;
    await assignToDay(pickerTodoId, pickerDate);
    setPickerTodoId("");
  }

  const selectedLabel = `${weekDays[0].getFullYear()}.${weekDays[0].getMonth() + 1}.${weekDays[0].getDate()} ~ ${weekDays[6].getMonth() + 1}.${weekDays[6].getDate()}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">캘린더</h1>
        <p className="text-sm text-muted">
          할일을 이 주에 배정하면 자동으로 빈 시간에 들어가고, 칸 안에서 끌어다 시간이나 날짜를 바꿀 수 있어요.
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

      <div className="flex gap-2">
        <select
          className="flex-1 rounded-sm border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus:border-2 focus:border-ink focus:outline-none"
          value={pickerTodoId}
          onChange={(e) => setPickerTodoId(e.target.value)}
        >
          <option value="">이 주에 추가할 할일 선택...</option>
          {unscheduled.map((t) => (
            <option key={t._id} value={t._id}>
              {t.title}
            </option>
          ))}
        </select>
        <select
          className="rounded-sm border border-hairline bg-canvas px-3 py-2 text-sm text-ink focus:border-2 focus:border-ink focus:outline-none"
          value={pickerDate}
          onChange={(e) => setPickerDate(e.target.value)}
        >
          {weekDays.map((d, i) => (
            <option key={weekKeys[i]} value={weekKeys[i]}>
              {["월", "화", "수", "목", "금", "토", "일"][i]} {d.getMonth() + 1}/{d.getDate()}
            </option>
          ))}
        </select>
        <button
          onClick={handleAssign}
          disabled={!pickerTodoId}
          className="rounded-sm bg-primary px-4 py-2 font-medium text-on-primary hover:bg-primary-active disabled:opacity-40"
        >
          추가
        </button>
      </div>

      {loading ? (
        <p className="text-body-text">불러오는 중...</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-hairline p-2">
          <WeekCalendar
            weekDays={weekDays}
            todos={todos.filter((t) => t.scheduledDate && weekKeys.includes(t.scheduledDate))}
            onMoveTodo={moveTodo}
            onToggleDone={toggleDone}
            onUnassign={unassign}
          />
        </div>
      )}
    </main>
  );
}
