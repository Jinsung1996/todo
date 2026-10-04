import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import YearlyGoal from "@/models/YearlyGoal";
import WeeklyPlan from "@/models/WeeklyPlan";
import Todo from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";

type Params = { params: Promise<{ goalId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await dbConnect();
  const goal = await YearlyGoal.findById(goalId);
  if (!goal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toJSON(goal));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, description, year } = parsed.data;

  const update: Record<string, unknown> = {};
  if (title !== undefined) {
    if (typeof title !== "string" || !title) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    update.title = title;
  }
  if (description !== undefined) {
    if (typeof description !== "string") {
      return NextResponse.json({ error: "description must be a string" }, { status: 400 });
    }
    update.description = description;
  }
  if (year !== undefined) {
    if (typeof year !== "number" || Number.isNaN(year)) {
      return NextResponse.json({ error: "year must be a number" }, { status: 400 });
    }
    update.year = year;
  }

  await dbConnect();
  const goal = await YearlyGoal.findByIdAndUpdate(
    goalId,
    { $set: update },
    { returnDocument: "after", runValidators: true }
  );
  if (!goal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toJSON(goal));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await dbConnect();

  const goal = await YearlyGoal.findById(goalId);
  if (!goal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const weeks = await WeeklyPlan.find({ yearlyGoalId: goalId });
  const weekIds = weeks.map((w) => w._id as import("mongoose").Types.ObjectId);
  await Todo.deleteMany({ weeklyPlanId: { $in: weekIds } });
  await WeeklyPlan.deleteMany({ yearlyGoalId: goalId });
  await YearlyGoal.deleteOne({ _id: goalId });

  return NextResponse.json({ ok: true });
}
