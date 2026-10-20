"use client";

import { useEffect, useState } from "react";
import { DurationSelect, durationLabel, TimeSelect } from "@/components/TimeSelect";
import {
  describeRepeat,
  EVERY_DAY,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  WEEKDAYS,
  weekdayOfKey,
} from "@/lib/repeat";
import { DEFAULT_DURATION_MINUTES } from "@/lib/schedule";
import type { Todo } from "@/types";

type Mode = "daily" | "weekdays" | "custom";

function dateLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WEEKDAY_LABELS[weekdayOfKey(key)]})`;
}

/** 매일 / 주중 / 특정 요일, with the 월..일 toggles for the last one. */
export function WeekdayPicker({
  value,
  onChange,
  initialCustom,
}: {
  value: number[];
  onChange: (weekdays: number[]) => void;
  /** What 특정 요일 starts with when `value` is a preset. */
  initialCustom?: number[];
}) {
  const same = (a: number[]) => a.length === value.length && a.every((d) => value.includes(d));
  const [mode, setMode] = useState<Mode>(() =>
    same(EVERY_DAY) ? "daily" : same(WEEKDAYS) ? "weekdays" : "custom"
  );
  // The custom pick survives flipping to a preset and back.
  const [customDays, setCustomDays] = useState(() =>
    mode === "custom" ? value : (initialCustom ?? value)
  );

  function choose(next: Mode) {
    setMode(next);
    onChange(next === "daily" ? EVERY_DAY : next === "weekdays" ? WEEKDAYS : customDays);
  }

  function toggleDay(day: number) {
    const next = customDays.includes(day)
      ? customDays.filter((d) => d !== day)
      : [...customDays, day];
    setCustomDays(next);
    onChange(next);
  }

  const option = (key: Mode, label: string) => (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="radio"
        checked={mode === key}
        onChange={() => choose(key)}
        className="accent-primary"
      />
      {label}
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
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
    </div>
  );
}

function Backdrop({
  label,
  dataAttr,
  onClose,
  children,
}: {
  label: string;
  dataAttr: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        {...{ [dataAttr]: true }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-hairline bg-canvas p-5 shadow-elevated"
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Asked when a 🔁 반복 일정 is dropped on the calendar: exactly when (in
 * 30-minute steps, starting from where it was dropped), and whether just
 * this day or the same time from now on — every day, weekdays, or picked
 * days.
 */
export function RepeatDialog({
  todo,
  date,
  startTime: droppedAt,
  onOnce,
  onRepeat,
  onStopRepeat,
  onClose,
}: {
  todo: Todo;
  date: string;
  startTime: string;
  onOnce: (startTime: string, durationMinutes: number) => void;
  onRepeat: (weekdays: number[], startTime: string, durationMinutes: number) => void;
  onStopRepeat: () => void;
  onClose: () => void;
}) {
  const [repeating, setRepeating] = useState(false);
  const [startTime, setStartTime] = useState(droppedAt);
  const [duration, setDuration] = useState(todo.durationMinutes ?? DEFAULT_DURATION_MINUTES);
  const [weekdays, setWeekdays] = useState(EVERY_DAY);

  return (
    <Backdrop label="반복 일정 추가" dataAttr="data-repeat-dialog" onClose={onClose}>
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-ink">🔁 {todo.title}</h2>
        <p className="text-sm text-muted">{dateLabel(date)}</p>
        {todo.repeat && (
          <p className="text-xs text-muted">
            지금 {describeRepeat(todo.repeat)}에 반복 중이에요. 새로 정하면 이 날부터 바뀌어요.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          시작
          <TimeSelect value={startTime} onChange={setStartTime} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
          길이
          <DurationSelect value={duration} onChange={setDuration} />
        </label>
      </div>

      {!repeating ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onOnce(startTime, duration)}
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
            앞으로{" "}
            <span className="font-medium">
              {startTime} ({durationLabel(duration)})
            </span>
            에 언제 넣을까요?
          </p>
          <WeekdayPicker
            value={weekdays}
            onChange={setWeekdays}
            initialCustom={[weekdayOfKey(date)]}
          />
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
              onClick={() => onRepeat(weekdays, startTime, duration)}
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
    </Backdrop>
  );
}

/**
 * Asked when one copy a running repeat placed gets a new time or length:
 * just that day, or that day and every untouched one after it.
 */
export function RepeatScopeDialog({
  todo,
  template,
  startTime,
  durationMinutes,
  onOnlyThis,
  onAllAfter,
  onClose,
}: {
  todo: Todo;
  template: Todo;
  startTime: string;
  durationMinutes: number;
  onOnlyThis: () => void;
  onAllAfter: () => void;
  onClose: () => void;
}) {
  return (
    <Backdrop label="반복 일정 시간 변경" dataAttr="data-repeat-scope-dialog" onClose={onClose}>
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-ink">🔁 {todo.title}</h2>
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">
            {startTime} ({durationLabel(durationMinutes)})
          </span>
          로 바꿔요.
        </p>
        {template.repeat && (
          <p className="text-xs text-muted">
            {describeRepeat(template.repeat)} 반복 일정 중 하루예요.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onOnlyThis}
          className="rounded-sm border border-hairline px-4 py-2 text-sm text-ink hover:bg-surface-soft"
        >
          이 날만
        </button>
        <button
          type="button"
          onClick={onAllAfter}
          className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          이 날 이후 반복 일정 모두
        </button>
      </div>
      <button type="button" onClick={onClose} className="self-end text-xs text-muted hover:text-ink">
        취소
      </button>
    </Backdrop>
  );
}
