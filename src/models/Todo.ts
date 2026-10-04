import mongoose, { Schema, type InferSchemaType } from "mongoose";

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
    weeklyPlanId: {
      type: Schema.Types.ObjectId,
      ref: "WeeklyPlan",
      required: true,
    },
    scheduledDate: { type: String, required: false }, // local date key, e.g. "2026-03-05"
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false }, // unset = legacy, pre-auth
  },
  { timestamps: true }
);

export type TodoDoc = InferSchemaType<typeof TodoSchema>;

export default (mongoose.models.Todo as mongoose.Model<TodoDoc>) ||
  mongoose.model<TodoDoc>("Todo", TodoSchema);
