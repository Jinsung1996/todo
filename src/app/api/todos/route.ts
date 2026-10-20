import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Todo from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { getCurrentUser } from "@/lib/currentUser";
import { normalizeCategoryInput } from "@/lib/category";
import { DEFAULT_DURATION_MINUTES, isDateKey } from "@/lib/schedule";
import { openSlotOn } from "@/lib/autoSlot";
import { extendRepeats } from "@/lib/repeatSync";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const scheduledDate = request.nextUrl.searchParams.get("scheduledDate");
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  // Keeps 🔁 repeat copies a few weeks ahead as days go by.
  await extendRepeats(user._id);

  if (scheduledDate) {
    const todos = await Todo.find({ scheduledDate, userId: user._id }).sort({
      createdAt: 1,
    });
    return NextResponse.json(toJSON(todos));
  }

  const todos =
    status === "active"
      ? await Todo.find({ userId: user._id, status: { $in: ["TODO", "DOING"] } }).sort({
          createdAt: 1,
        })
      : status === "done"
        ? await Todo.find({ userId: user._id, status: "DONE" }).sort({ createdAt: 1 })
        : await Todo.find({ userId: user._id }).sort({ createdAt: 1 });

  return NextResponse.json(toJSON(todos));
}

// Creates a standalone "일간 목표" item with no weeklyPlanId — the exception
// path for things that don't belong under 연간 목표 -> 주간 목표: a recurring
// routine (출근, 운동), a one-off appointment, a special event (토익 등).
// Goal-linked todos are still created via /api/weeks/[weekId]/todos.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, description, category, isRecurring, scheduledDate } = parsed.data;

  if (typeof title !== "string" || !title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (description !== undefined && typeof description !== "string") {
    return NextResponse.json({ error: "description must be a string" }, { status: 400 });
  }
  const categoryResult = normalizeCategoryInput(category);
  if (!categoryResult.ok) {
    return NextResponse.json({ error: categoryResult.error }, { status: 400 });
  }
  if (isRecurring !== undefined && typeof isRecurring !== "boolean") {
    return NextResponse.json({ error: "isRecurring must be a boolean" }, { status: 400 });
  }
  // Set by the month calendar's per-day "+" — an appointment entered ahead
  // of time straight onto its day, auto-placed in the next open time slot.
  if (scheduledDate !== undefined && !isDateKey(scheduledDate)) {
    return NextResponse.json(
      { error: "scheduledDate must be a YYYY-MM-DD string" },
      { status: 400 }
    );
  }
  // A 🔁 template is never placed itself — see src/lib/recurring.ts.
  if (scheduledDate !== undefined && isRecurring === true) {
    return NextResponse.json(
      { error: "a recurring todo can't have a scheduledDate" },
      { status: 400 }
    );
  }

  await dbConnect();
  const placement =
    isDateKey(scheduledDate)
      ? {
          scheduledDate,
          startTime: await openSlotOn(user._id, scheduledDate, DEFAULT_DURATION_MINUTES),
        }
      : {};
  const todo = await Todo.create({
    ...placement,
    title,
    description: typeof description === "string" ? description : undefined,
    category: categoryResult.category ?? undefined,
    isRecurring: isRecurring === true,
    userId: user._id,
  });
  return NextResponse.json(toJSON(todo), { status: 201 });
}
