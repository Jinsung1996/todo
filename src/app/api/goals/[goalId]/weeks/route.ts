import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import YearlyGoal from "@/models/YearlyGoal";
import WeeklyPlan from "@/models/WeeklyPlan";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";

type Params = { params: Promise<{ goalId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json([], { status: 200 });
  }
  await dbConnect();
  const weeks = await WeeklyPlan.find({ yearlyGoalId: goalId }).sort({
    weekStart: 1,
  });
  return NextResponse.json(toJSON(weeks));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json({ error: "yearly goal not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, weekStart, weekEnd } = parsed.data;

  if (
    typeof title !== "string" ||
    !title ||
    typeof weekStart !== "string" ||
    typeof weekEnd !== "string" ||
    Number.isNaN(Date.parse(weekStart)) ||
    Number.isNaN(Date.parse(weekEnd))
  ) {
    return NextResponse.json(
      { error: "title, weekStart and weekEnd (valid dates) are required" },
      { status: 400 }
    );
  }

  await dbConnect();
  const goal = await YearlyGoal.findById(goalId);
  if (!goal) {
    return NextResponse.json({ error: "yearly goal not found" }, { status: 404 });
  }

  const week = await WeeklyPlan.create({
    title,
    weekStart,
    weekEnd,
    yearlyGoalId: goalId,
  });
  return NextResponse.json(toJSON(week), { status: 201 });
}
