/**
 * "앞으로도 같은 시간에" repeat rules for a 🔁 반복 일정 template. The rule
 * lives on the template; the calendar only ever shows real copies, which
 * are created a few weeks ahead at a time (see src/lib/repeatSync.ts) so
 * each day keeps its own status, and removing one day never brings it back.
 */

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]; // Date#getDay(): 0=일 .. 6=토
export const WEEKDAYS = [1, 2, 3, 4, 5];
// How far ahead copies exist; the window slides forward as days pass.
export const REPEAT_HORIZON_DAYS = 56;

// 월..일, the calendar's column order.
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_LABELS: Record<number, string> = {
  0: "일",
  1: "월",
  2: "화",
  3: "수",
  4: "목",
  5: "금",
  6: "토",
};

interface RepeatLinked {
  _id: string;
  repeatSourceId?: string | null;
  repeat?: RepeatRule | null;
}

/**
 * The 🔁 template whose running rule placed `todo`, if any — editing such
 * a copy's time can offer "이후 반복 일정 모두".
 */
export function activeRepeatTemplate<T extends RepeatLinked>(todo: RepeatLinked, todos: T[]): T | null {
  if (!todo.repeatSourceId) return null;
  return todos.find((t) => t._id === todo.repeatSourceId && t.repeat) ?? null;
}

export interface RepeatRule {
  startTime: string;
  weekdays: number[];
  /** Last date key copies have been created through. */
  through: string;
}

// Date keys are calendar dates, not instants — doing the arithmetic in UTC
// keeps it free of the server's/browser's time zone and DST.
function keyToUTC(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDaysToKey(key: string, days: number): string {
  const date = keyToUTC(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekdayOfKey(key: string): number {
  return keyToUTC(key).getUTCDay();
}

/** Every date key from `from` through `through` (inclusive) on `weekdays`. */
export function repeatDates(weekdays: number[], from: string, through: string): string[] {
  const dates: string[] = [];
  for (let key = from; key <= through; key = addDaysToKey(key, 1)) {
    if (weekdays.includes(weekdayOfKey(key))) dates.push(key);
  }
  return dates;
}

export function isWeekdayList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 7 &&
    new Set(value).size === value.length &&
    value.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  );
}

function sameDays(a: number[], b: number[]): boolean {
  return a.length === b.length && b.every((d) => a.includes(d));
}

/** "매일" / "주중" / "월·수·금" */
export function describeWeekdays(weekdays: number[]): string {
  if (sameDays(weekdays, EVERY_DAY)) return "매일";
  if (sameDays(weekdays, WEEKDAYS)) return "주중";
  return WEEKDAY_ORDER.filter((d) => weekdays.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join("·");
}

export function describeRepeat(rule: Pick<RepeatRule, "startTime" | "weekdays">): string {
  return `${describeWeekdays(rule.weekdays)} ${rule.startTime}`;
}

/**
 * A copy a repeat rule placed on a day still ahead. Those exist only so
 * the calendar shows them — lists and completion rates leave them out
 * until their day comes, or they'd fill up with weeks of the same item.
 */
export function isUpcomingRepeat(
  todo: { repeatSourceId?: unknown; scheduledDate?: string | null },
  today: string
): boolean {
  return Boolean(todo.repeatSourceId && todo.scheduledDate && todo.scheduledDate > today);
}
