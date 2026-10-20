import { NextResponse } from "next/server";
import { isDurationMinutes, TIME_RE } from "@/lib/schedule";
import { isWeekdayList } from "@/lib/repeat";

type Parsed =
  | { ok: true; startTime?: string; durationMinutes?: number; weekdays?: number[] }
  | { ok: false; response: NextResponse };

/** The optional rule fields shared by setting and editing a repeat. */
export function parseRepeatFields(body: Record<string, unknown>): Parsed {
  const { startTime, durationMinutes, weekdays } = body;
  const bad = (error: string): Parsed => ({
    ok: false,
    response: NextResponse.json({ error }, { status: 400 }),
  });
  if (startTime !== undefined && (typeof startTime !== "string" || !TIME_RE.test(startTime))) {
    return bad("startTime must be an HH:mm string");
  }
  if (durationMinutes !== undefined && !isDurationMinutes(durationMinutes)) {
    return bad("durationMinutes must be a number of minutes between 15 and 1440");
  }
  if (weekdays !== undefined && !isWeekdayList(weekdays)) {
    return bad("weekdays must list 1–7 distinct days, 0 (일) to 6 (토)");
  }
  return {
    ok: true,
    startTime: startTime as string | undefined,
    durationMinutes: durationMinutes as number | undefined,
    weekdays: weekdays as number[] | undefined,
  };
}
