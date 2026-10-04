import mongoose, { Schema, type InferSchemaType } from "mongoose";

const WeeklyPlanSchema = new Schema(
  {
    title: { type: String, required: true },
    weekStart: { type: Date, required: true },
    weekEnd: { type: Date, required: true },
    yearlyGoalId: {
      type: Schema.Types.ObjectId,
      ref: "YearlyGoal",
      required: true,
    },
  },
  { timestamps: true }
);

export type WeeklyPlanDoc = InferSchemaType<typeof WeeklyPlanSchema>;

export default (mongoose.models.WeeklyPlan as mongoose.Model<WeeklyPlanDoc>) ||
  mongoose.model<WeeklyPlanDoc>("WeeklyPlan", WeeklyPlanSchema);
