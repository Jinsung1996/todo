import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import WeeklyPlan from "@/models/WeeklyPlan";
import Todo from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";

type Params = { params: Promise<{ weekId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { weekId } = await params;
  if (!isValidObjectId(weekId)) {
    return NextResponse.json([], { status: 200 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const todos = await Todo.find({ weeklyPlanId: weekId, userId: user._id }).sort({
    createdAt: 1,
  });
  return NextResponse.json(toJSON(todos));
}

export async function POST(request: NextRequest, { params }: Params) {
  const { weekId } = await params;
  if (!isValidObjectId(weekId)) {
    return NextResponse.json({ error: "weekly plan not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, description } = parsed.data;

  if (typeof title !== "string" || !title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json({ error: "description must be a string" }, { status: 400 });
  }

  await dbConnect();
  const week = await WeeklyPlan.findById(weekId);
  if (!week) {
    return NextResponse.json(
      { error: "weekly plan not found" },
      { status: 404 }
    );
  }

  const todo = await Todo.create({
    title,
    description: typeof description === "string" ? description : undefined,
    weeklyPlanId: weekId,
    userId: user._id,
  });
  return NextResponse.json(toJSON(todo), { status: 201 });
}
