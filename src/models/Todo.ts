import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { CATEGORY_MAX_LENGTH } from "@/lib/category";

export const TODO_STATUSES = ["TODO", "DOING", "DONE"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];

const TodoSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: TODO_STATUSES,
      default: "TODO",
    },
    // Free text, not an enum — everyone organizes 일간 목표 differently, so
    // the week calendar's color-coding (see src/lib/category.ts) hashes
    // whatever string is here into a color rather than looking it up from a
    // fixed list.
    category: { type: String, required: false, trim: true, maxlength: CATEGORY_MAX_LENGTH },
    // Optional: unset for a standalone "일간 목표" exception item (a
    // recurring routine, a one-off appointment, etc.) created directly from
    // the daily page rather than under 연간 목표 -> 주간 목표.
    weeklyPlanId: {
      type: Schema.Types.ObjectId,
      ref: "WeeklyPlan",
      required: false,
    },
    scheduledDate: { type: String, required: false }, // local date key, e.g. "2026-03-05"
    startTime: { type: String, required: false }, // "HH:mm", 24h local time; set once scheduledDate is
    durationMinutes: { type: Number, required: false, default: 60 }, // block length in the week calendar
    // 아침/점심/저녁 같은 매일 반복 습관: once placed on the calendar it stays
    // pinned to today's column every day (see src/lib/recurring.ts) instead
    // of needing to be re-created after each completion.
    isRecurring: { type: Boolean, default: false },
    lastCompletedDate: { type: String, required: false }, // local date key of the last day it was checked off
    // On a 🔁 template: "앞으로도 같은 시간에" — see src/lib/repeat.ts.
    repeat: {
      type: new Schema(
        { startTime: String, weekdays: [Number], through: String },
        { _id: false }
      ),
      required: false,
      default: undefined,
    },
    // On a copy created by a template's repeat rule, so stopping the rule
    // can remove the copies still ahead.
    repeatSourceId: { type: Schema.Types.ObjectId, ref: "Todo", required: false },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false }, // unset = legacy, pre-auth
  },
  { timestamps: true }
);

export type TodoDoc = InferSchemaType<typeof TodoSchema>;

export default (mongoose.models.Todo as mongoose.Model<TodoDoc>) ||
  mongoose.model<TodoDoc>("Todo", TodoSchema);
