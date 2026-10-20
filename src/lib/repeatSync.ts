import type { Types } from "mongoose";
import Todo from "@/models/Todo";
import { DEFAULT_DURATION_MINUTES } from "@/lib/schedule";
import { addDaysToKey, REPEAT_HORIZON_DAYS, repeatDates } from "@/lib/repeat";
import { dateKey } from "@/lib/week";

type UserId = Types.ObjectId | string;

interface Source {
  _id: Types.ObjectId;
  title: string;
  description?: string | null;
  category?: string | null;
  weeklyPlanId?: Types.ObjectId | null;
  durationMinutes?: number | null;
}

/** The fields of a placed occurrence of `source` (a plain, non-🔁 todo). */
export function occurrenceOf(
  source: Source,
  userId: UserId,
  scheduledDate: string,
  startTime: string
) {
  return {
    title: source.title,
    description: source.description ?? undefined,
    category: source.category ?? undefined,
    weeklyPlanId: source.weeklyPlanId ?? undefined,
    durationMinutes: source.durationMinutes ?? DEFAULT_DURATION_MINUTES,
    scheduledDate,
    startTime,
    isRecurring: false,
    userId,
  };
}

/**
 * Places `template`'s repeat copies on `dates` at `startTime`, skipping any
 * day that already has one.
 */
export async function placeRepeatCopies(
  template: Source,
  userId: UserId,
  dates: string[],
  startTime: string
) {
  if (dates.length === 0) return [];
  const existing = await Todo.find({
    userId,
    repeatSourceId: template._id,
    scheduledDate: { $in: dates },
  }).select("scheduledDate");
  const taken = new Set(existing.map((t) => t.scheduledDate));
  const docs = dates
    .filter((date) => !taken.has(date))
    .map((date) => ({
      ...occurrenceOf(template, userId, date, startTime),
      repeatSourceId: template._id,
    }));
  return docs.length > 0 ? Todo.insertMany(docs) : [];
}

/**
 * Removes the not-yet-started repeat copies of `templateId` dated after
 * `after` — the ones still ahead when a rule is changed or stopped. Past,
 * 진행 중 and 완료 copies stay as a record.
 */
export async function removeUpcomingCopies(templateId: Types.ObjectId, userId: UserId, after: string) {
  await Todo.deleteMany({
    userId,
    repeatSourceId: templateId,
    scheduledDate: { $gt: after },
    status: "TODO",
  });
}

/**
 * Slides every repeat window of this user forward to REPEAT_HORIZON_DAYS
 * past `today`. Each window is claimed with a conditional update first, so
 * two requests racing here never both create the same days.
 */
export async function extendRepeats(userId: UserId, today: string = dateKey()) {
  const target = addDaysToKey(today, REPEAT_HORIZON_DAYS);
  const templates = await Todo.find({
    userId,
    isRecurring: true,
    "repeat.through": { $lt: target },
  });
  for (const template of templates) {
    const rule = template.repeat;
    if (!rule?.through || !rule.startTime) continue;
    const claimed = await Todo.updateOne(
      { _id: template._id, "repeat.through": rule.through },
      { $set: { "repeat.through": target } }
    );
    if (claimed.modifiedCount === 0) continue;
    // A rule untouched for longer than the window doesn't backfill the
    // days nobody opened the app.
    const next = addDaysToKey(rule.through, 1);
    const from = next > today ? next : today;
    await placeRepeatCopies(
      template,
      userId,
      repeatDates(rule.weekdays, from, target),
      rule.startTime
    );
  }
}
