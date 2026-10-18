import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { CATEGORY_COLOR_KEYS, CATEGORY_MAX_LENGTH } from "@/lib/category";

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: CATEGORY_MAX_LENGTH },
    colorKey: { type: String, required: true, enum: CATEGORY_COLOR_KEYS },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// One category per name per user — re-adding the same name updates its
// color instead of creating a duplicate entry (enforced in the POST route).
CategorySchema.index({ userId: 1, name: 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof CategorySchema>;

export default (mongoose.models.Category as mongoose.Model<CategoryDoc>) ||
  mongoose.model<CategoryDoc>("Category", CategorySchema);
