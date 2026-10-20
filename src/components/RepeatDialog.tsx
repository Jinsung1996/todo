"use client";

import { useEffect, useState } from "react";
import {
  describeRepeat,
  EVERY_DAY,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  WEEKDAYS,
  weekdayOfKey,
} from "@/lib/repeat";
import type { Todo } from "@/types";

type Mode = "daily" | "weekdays" | "custom";

function dateLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[weekdayOfKey(key)]})`;
}

/**
 * Asked when a 🔁 반복 일정 is dropped on the calendar: just this day, or
 * the same time from now on — every day, weekdays, or picked days.
 */
export function RepeatDialog({
  todo,
  date,
  startTime,
  onOnce,
  onRepeat,
  onStopRepeat,
  onClose,
}: {
  todo: Todo;
  date: string;
  /** Unset for a month-view drop: the server picks an open slot. */
  startTime?: string;
  onOnce: () => void;
  onRepeat: (weekdays: number[]) => void;
  onStopRepeat: () => void;
  onClose: () => void;
}) {
  const [repeating, setRepeating] = useState(false);
  const [mode, setMode] = useState<Mode>("daily");
  // Starts on the dropped-on day, the most likely pick.
  const [customDays, setCustomDays] = useState<number[]>(() => [weekdayOfKey(date)]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const weekdays = mode === "daily" ? EVERY_DAY : mode === "weekdays" ? WEEKDAYS : customDays;
  const when = startTime ?? "빈 시간";

  function toggleDay(day: number) {
    setCustomDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day]
    );
  }

  const option = (value: Mode, label: string) => (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="radio"
        name="repeat-mode"
        checked={mode === value}
        onChange={() => setMode(value)}
        className="accent-primary"
      />
      {label}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="반복 일정 추가"
        data-repeat-dialog
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-hairline bg-canvas p-5 shadow-elevated"
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-ink">🔁 {todo.title}</h2>
          <p className="text-sm text-muted">
            {dateLabel(date)} {when}에 추가해요.
          </p>
          {todo.repeat && (
            <p className="text-xs text-muted">
              지금 {describeRepeat(todo.repeat)}에 반복 중이에요. 새로 정하면 이 날부터 바뀌어요.
            </p>
          )}
        </div>

        {!repeating ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onOnce}
              className="rounded-sm border border-hairline px-4 py-2 text-sm text-ink hover:bg-surface-soft"
            >
              이 날만 추가
            </button>
            <button
              type="button"
              onClick={() => setRepeating(true)}
              className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-on-primary"
            >
              앞으로도 같은 시간에 반복
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink">
              앞으로 <span className="font-medium">{when}</span>에 언제 넣을까요?
            </p>
            {option("daily", "매일 (주말 포함)")}
            {option("weekdays", "주중 (월–금)")}
            {option("custom", "특정 요일")}
            {mode === "custom" && (
              <div className="flex gap-1 pl-6">
                {WEEKDAY_ORDER.map((day) => (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={customDays.includes(day)}
                    onClick={() => toggleDay(day)}
                    className={`h-8 w-8 rounded-full text-xs ${
                      customDays.includes(day)
                        ? "bg-primary font-medium text-on-primary"
                        : "border border-hairline text-ink"
                    }`}
                  >
                    {WEEKDAY_LABELS[day]}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setRepeating(false)}
                className="rounded-sm border border-hairline px-4 py-2 text-sm text-ink hover:bg-surface-soft"
              >
                뒤로
              </button>
              <button
                type="button"
                disabled={weekdays.length === 0}
                onClick={() => onRepeat(weekdays)}
                className="flex-1 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-on-primary disabled:opacity-40"
              >
                반복 추가
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          {todo.repeat ? (
            <button
              type="button"
              onClick={onStopRepeat}
              className="text-xs text-error hover:text-error-hover"
            >
              반복 중지
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
