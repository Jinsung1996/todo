"use client";

import { minutesToTime, SLOT_STEP_MINUTES, timeToMinutes } from "@/lib/schedule";

// Every start the calendar grid snaps to: 00:00, 00:30 … 23:30.
const TIMES = Array.from({ length: (24 * 60) / SLOT_STEP_MINUTES }, (_, i) =>
  minutesToTime(i * SLOT_STEP_MINUTES)
);
// 30분 … 8시간.
const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * SLOT_STEP_MINUTES);

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}시간` : "", m ? `${m}분` : ""].filter(Boolean).join(" ");
}

function withValue<T>(options: T[], value: T, order: (v: T) => number): T[] {
  return options.includes(value)
    ? options
    : [...options, value].sort((a, b) => order(a) - order(b));
}

const selectClass =
  "w-full rounded-sm border border-hairline bg-canvas px-2 py-2 text-base text-ink focus:border-ink focus:outline-none sm:text-sm";

/** A start time in 30-minute steps (an off-grid saved value stays pickable). */
export function TimeSelect({
  value,
  onChange,
  label = "시작 시간",
}: {
  value: string;
  onChange: (time: string) => void;
  label?: string;
}) {
  return (
    <select
      aria-label={label}
      data-time-select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
    >
      {withValue(TIMES, value, timeToMinutes).map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

/** A block length in 30-minute steps. */
export function DurationSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <select
      aria-label="길이"
      data-duration-select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={selectClass}
    >
      {withValue(DURATIONS, value, (v) => v).map((m) => (
        <option key={m} value={m}>
          {durationLabel(m)}
        </option>
      ))}
    </select>
  );
}
