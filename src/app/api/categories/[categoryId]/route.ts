import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Category from "@/models/Category";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";

type Params = { params: Promise<{ categoryId: string }> };

// Deleting a category only removes it from the picker — todos that already
// used its name keep that text and fall back to the hash-based color (see
// resolveCategoryStyle in src/lib/category.ts) instead of losing their
// category.
export async function DELETE(request: NextRequest, { params }: Params) {
  const { categoryId } = await params;
  if (!isValidObjectId(categoryId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const category = await Category.findOneAndDelete({ _id: categoryId, userId: user._id });
  if (!category) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
