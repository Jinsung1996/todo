import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Todo, { TODO_STATUSES, type TodoStatus } from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";
import { DEFAULT_DURATION_MINUTES, nextAvailableSlot } from "@/lib/schedule";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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
  const { title, description, status, scheduledDate, startTime, durationMinutes } = parsed.data;

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
  if (durationMinutes !== undefined) {
    if (
      typeof durationMinutes !== "number" ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 24 * 60
    ) {
      return NextResponse.json(
        { error: "durationMinutes must be a number of minutes between 15 and 1440" },
        { status: 400 }
      );
    }
    update.durationMinutes = durationMinutes;
  }
  if (startTime !== undefined) {
    if (startTime !== null && (typeof startTime !== "string" || !TIME_RE.test(startTime))) {
      return NextResponse.json(
        { error: "startTime must be an HH:mm string or null" },
        { status: 400 }
      );
    }
    update.startTime = startTime;
  }

  // Scheduling a todo onto a day (and leaving its time unspecified) auto-fills
  // the next open slot in the week calendar's time grid, like writing it on
  // the next empty line of a notepad — the user doesn't have to hand-place it.
  let autoSlotDate: string | null = null;
  if (scheduledDate !== undefined) {
    if (scheduledDate === null) {
      update.scheduledDate = null;
      // A todo with no day shouldn't keep a stale time slot, unless the
      // caller explicitly set one in this same request.
      if (startTime === undefined) update.startTime = null;
    } else if (typeof scheduledDate !== "string" || Number.isNaN(Date.parse(scheduledDate))) {
      return NextResponse.json(
        { error: "scheduledDate must be a valid date string or null" },
        { status: 400 }
      );
    } else {
      update.scheduledDate = scheduledDate;
      if (startTime === undefined) autoSlotDate = scheduledDate;
    }
  }

  await dbConnect();

  if (autoSlotDate) {
    const current = await Todo.findOne({ _id: todoId, userId: user._id }).select(
      "startTime durationMinutes"
    );
    if (!current) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    // Only auto-place a todo that doesn't already have a time — moving an
    // already-scheduled todo to a different day keeps its existing time.
    if (!current.startTime) {
      const siblings = await Todo.find({
        scheduledDate: autoSlotDate,
        userId: user._id,
        _id: { $ne: todoId },
        startTime: { $ne: null },
      }).select("startTime durationMinutes");
      update.startTime = nextAvailableSlot(
        siblings.map((t) => ({
          startTime: t.startTime as string,
          durationMinutes: t.durationMinutes ?? DEFAULT_DURATION_MINUTES,
        })),
        (update.durationMinutes as number | undefined) ??
          current.durationMinutes ??
          DEFAULT_DURATION_MINUTES
      );
    }
  }

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
