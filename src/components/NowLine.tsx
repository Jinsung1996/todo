import { GRID_START_MINUTES, minutesToTime } from "@/lib/schedule";

/** Minutes since local midnight for a `useNowMinute()` value. */
export function minuteOfDay(nowMinute: number): number {
  const now = new Date(nowMinute * 60_000);
  return now.getHours() * 60 + now.getMinutes();
}

/**
 * The red "지금" line across today's column — drawn over the blocks so the
 * one it crosses reads as what to be doing now, under one being dragged.
 */
export function NowLine({ minute, pxPerMinute }: { minute: number; pxPerMinute: number }) {
  return (
    <div
      data-now-line
      aria-hidden
      style={{ top: (minute - GRID_START_MINUTES) * pxPerMinute }}
      className="pointer-events-none absolute inset-x-0 z-[15] -translate-y-1/2"
    >
      <div className="h-0.5 bg-error" />
      <div className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-error" />
    </div>
  );
}

/** The current time in the hour gutter, level with the line. */
export function NowLabel({ minute, pxPerMinute }: { minute: number; pxPerMinute: number }) {
  return (
    <div
      data-now-label
      style={{ top: (minute - GRID_START_MINUTES) * pxPerMinute }}
      className="pointer-events-none absolute right-0.5 z-[15] -translate-y-1/2 rounded-full bg-error px-1 text-[10px] font-semibold leading-4 text-white"
    >
      {minutesToTime(minute)}
    </div>
  );
}
