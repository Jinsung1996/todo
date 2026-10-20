/** Google-Calendar-style week grid bounds and auto time-slotting for todos. */

// The grid covers the whole day so 새벽 일정 have a place too; it opens
// scrolled to DAY_START_MINUTES, where auto-placement also starts looking.
export const GRID_START_MINUTES = 0; // 00:00
export const GRID_END_MINUTES = 24 * 60; // 24:00
export const DAY_START_MINUTES = 7 * 60; // 07:00
export const DEFAULT_DURATION_MINUTES = 60;
export const SLOT_STEP_MINUTES = 30;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date as "YYYY-MM-DD" (rejects e.g. 2026-13-45). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_KEY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** A block length the calendar accepts: 15 minutes to a whole day. */
export function isDurationMinutes(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= 15 && value <= 24 * 60
  );
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.round(minutes));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Rounds `minutes` to the nearest `step` (defaults to the grid's drag step). */
export function snapMinutes(minutes: number, step: number = SLOT_STEP_MINUTES): number {
  return Math.round(minutes / step) * step;
}

export interface TimeBlock {
  startTime: string;
  durationMinutes: number;
}

/**
 * The first open slot of `durationMinutes` on a day already holding
 * `existing` blocks — scanning forward from DAY_START_MINUTES in
 * SLOT_STEP_MINUTES steps, like a notebook filling in the next free line.
 * If the grid window is fully booked, stacks right after the last existing
 * block instead of refusing to schedule (a todo entered for "today" should
 * always land somewhere, even if it's a packed day).
 */
export function nextAvailableSlot(
  existing: TimeBlock[],
  durationMinutes: number = DEFAULT_DURATION_MINUTES
): string {
  const busy = existing
    .map((b) => {
      const start = timeToMinutes(b.startTime);
      return { start, end: start + b.durationMinutes };
    })
    .sort((a, b) => a.start - b.start);

  for (
    let candidate = DAY_START_MINUTES;
    candidate + durationMinutes <= GRID_END_MINUTES;
    candidate += SLOT_STEP_MINUTES
  ) {
    const candidateEnd = candidate + durationMinutes;
    const overlaps = busy.some((b) => candidate < b.end && candidateEnd > b.start);
    if (!overlaps) return minutesToTime(candidate);
  }

  const lastEnd = busy.length > 0 ? Math.max(...busy.map((b) => b.end)) : DAY_START_MINUTES;
  return minutesToTime(lastEnd);
}
