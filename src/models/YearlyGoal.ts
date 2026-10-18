import mongoose, { Schema, type InferSchemaType } from "mongoose";

const YearlyGoalSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    year: { type: Number, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: false, index: true }, // unset = legacy, pre-ownership (see claimOrphanGoals)
  },
  { timestamps: true }
);

export type YearlyGoalDoc = InferSchemaType<typeof YearlyGoalSchema>;

export default (mongoose.models.YearlyGoal as mongoose.Model<YearlyGoalDoc>) ||
  mongoose.model<YearlyGoalDoc>("YearlyGoal", YearlyGoalSchema);
