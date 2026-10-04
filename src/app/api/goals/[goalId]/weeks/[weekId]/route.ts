import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import WeeklyPlan from "@/models/WeeklyPlan";
import Todo from "@/models/Todo";
import { weeklyProgress } from "@/lib/progress";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";

type Params = { params: Promise<{ goalId: string; weekId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { weekId } = await params;
  if (!isValidObjectId(weekId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const week = await WeeklyPlan.findById(weekId);
  if (!week) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const todos = await Todo.find({ weeklyPlanId: weekId, userId: user._id });
  return NextResponse.json({
    ...toJSON(week),
    progress: weeklyProgress(todos),
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { weekId } = await params;
  if (!isValidObjectId(weekId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, weekStart, weekEnd } = parsed.data;

  const update: Record<string, unknown> = {};
  if (title !== undefined) {
    if (typeof title !== "string" || !title) {
      return NextResponse.json({ error: "title must be a non-empty string" }, { status: 400 });
    }
    update.title = title;
  }
  if (weekStart !== undefined) {
    if (typeof weekStart !== "string" || Number.isNaN(Date.parse(weekStart))) {
      return NextResponse.json({ error: "weekStart must be a valid date" }, { status: 400 });
    }
    update.weekStart = weekStart;
  }
  if (weekEnd !== undefined) {
    if (typeof weekEnd !== "string" || Number.isNaN(Date.parse(weekEnd))) {
      return NextResponse.json({ error: "weekEnd must be a valid date" }, { status: 400 });
    }
    update.weekEnd = weekEnd;
  }

  await dbConnect();
  const week = await WeeklyPlan.findByIdAndUpdate(
    weekId,
    { $set: update },
    { returnDocument: "after", runValidators: true }
  );
  if (!week) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toJSON(week));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { weekId } = await params;
  if (!isValidObjectId(weekId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await dbConnect();
  const week = await WeeklyPlan.findById(weekId);
  if (!week) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await Todo.deleteMany({ weeklyPlanId: weekId });
  await WeeklyPlan.deleteOne({ _id: weekId });
  return NextResponse.json({ ok: true });
}
