import mongoose, { Schema, type InferSchemaType } from "mongoose";

const SessionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type SessionDoc = InferSchemaType<typeof SessionSchema>;

export default (mongoose.models.Session as mongoose.Model<SessionDoc>) ||
  mongoose.model<SessionDoc>("Session", SessionSchema);
