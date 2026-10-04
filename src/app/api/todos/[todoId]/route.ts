import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Todo, { TODO_STATUSES, type TodoStatus } from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";

type Params = { params: Promise<{ todoId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { todoId } = await params;
  if (!isValidObjectId(todoId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const todo = await Todo.findOne({ _id: todoId, userId: user._id }).populate({
    path: "weeklyPlanId",
    populate: { path: "yearlyGoalId" },
  });
  if (!todo) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toJSON(todo));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { todoId } = await params;
  if (!isValidObjectId(todoId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, description, status, scheduledDate } = parsed.data;

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
  if (status !== undefined) {
    if (typeof status !== "string" || !TODO_STATUSES.includes(status as TodoStatus)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = status;
  }
  if (scheduledDate !== undefined) {
    if (scheduledDate === null) {
      update.scheduledDate = null;
    } else if (typeof scheduledDate !== "string" || Number.isNaN(Date.parse(scheduledDate))) {
      return NextResponse.json(
        { error: "scheduledDate must be a valid date string or null" },
        { status: 400 }
      );
    } else {
      update.scheduledDate = scheduledDate;
    }
  }

  await dbConnect();
  const todo = await Todo.findOneAndUpdate(
    { _id: todoId, userId: user._id },
    { $set: update },
    { returnDocument: "after", runValidators: true }
  );
  if (!todo) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toJSON(todo));
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { todoId } = await params;
  if (!isValidObjectId(todoId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const todo = await Todo.findOneAndDelete({ _id: todoId, userId: user._id });
  if (!todo) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
