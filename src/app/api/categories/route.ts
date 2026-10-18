import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Category from "@/models/Category";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { getCurrentUser } from "@/lib/currentUser";
import { isCategoryColorKey, normalizeCategoryInput } from "@/lib/category";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const categories = await Category.find({ userId: user._id }).sort({ createdAt: 1 });
  return NextResponse.json(toJSON(categories));
}

// Registers a category name with a user-chosen color — once saved, any
// todo using that category name picks up this color instead of the
// hash-based fallback (see src/lib/category.ts's resolveCategoryStyle).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { name, colorKey } = parsed.data;

  const nameResult = normalizeCategoryInput(name);
  if (!nameResult.ok) {
    return NextResponse.json({ error: nameResult.error }, { status: 400 });
  }
  if (!nameResult.category) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!isCategoryColorKey(colorKey)) {
    return NextResponse.json({ error: "invalid colorKey" }, { status: 400 });
  }

  await dbConnect();
  // Re-registering an existing name just recolors it instead of erroring —
  // lets the user fix a color mistake by "adding" the same category again.
  const category = await Category.findOneAndUpdate(
    { userId: user._id, name: nameResult.category },
    { $set: { colorKey } },
    { upsert: true, returnDocument: "after", runValidators: true }
  );
  return NextResponse.json(toJSON(category), { status: 201 });
}
