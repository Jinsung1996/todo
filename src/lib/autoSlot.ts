import type { Types } from "mongoose";
import Todo from "@/models/Todo";
import { DEFAULT_DURATION_MINUTES, nextAvailableSlot } from "@/lib/schedule";

/**
 * The next open time slot on `date` for this user's calendar, skipping
 * `excludeId` (the todo being placed, when it's already on that day).
 */
export async function openSlotOn(
  userId: Types.ObjectId | string,
  date: string,
  durationMinutes: number,
  excludeId?: string
): Promise<string> {
  const siblings = await Todo.find({
    scheduledDate: date,
    userId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    startTime: { $ne: null },
    // Hidden 🔁 templates (legacy placements) don't occupy the grid.
    isRecurring: { $ne: true },
  }).select("startTime durationMinutes");
  return nextAvailableSlot(
    siblings.map((t) => ({
      startTime: t.startTime as string,
      durationMinutes: t.durationMinutes ?? DEFAULT_DURATION_MINUTES,
    })),
    durationMinutes
  );
}
