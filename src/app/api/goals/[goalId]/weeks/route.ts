import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import YearlyGoal from "@/models/YearlyGoal";
import WeeklyPlan from "@/models/WeeklyPlan";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";

type Params = { params: Promise<{ goalId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json([], { status: 200 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const weeks = await WeeklyPlan.find({ yearlyGoalId: goalId, userId: user._id }).sort({
    weekStart: 1,
  });
  return NextResponse.json(toJSON(weeks));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { goalId } = await params;
  if (!isValidObjectId(goalId)) {
    return NextResponse.json({ error: "yearly goal not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
  const goal = await YearlyGoal.findOne({ _id: goalId, userId: user._id });
  if (!goal) {
    return NextResponse.json({ error: "yearly goal not found" }, { status: 404 });
  }

  const week = await WeeklyPlan.create({
    title,
    weekStart,
    weekEnd,
    yearlyGoalId: goalId,
    userId: user._id,
  });
  return NextResponse.json(toJSON(week), { status: 201 });
}
