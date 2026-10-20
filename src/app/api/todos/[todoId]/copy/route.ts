import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Todo from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";
import { DEFAULT_DURATION_MINUTES, isDateKey, isDurationMinutes, TIME_RE } from "@/lib/schedule";
import { openSlotOn } from "@/lib/autoSlot";
import { occurrenceOf } from "@/lib/repeatSync";

type Params = { params: Promise<{ todoId: string }> };

// Places another occurrence of an existing 일간 목표 on the calendar — the
// same 공부 in the morning and again in the afternoon, or a 🔁 반복 일정
// (점심식사 등) dragged onto whichever day it's needed. The source todo is
// left untouched; the copy is a regular todo with its own status, so
// checking off one occurrence never affects the others.
export async function POST(request: NextRequest, { params }: Params) {
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
  const { scheduledDate, startTime, durationMinutes: requestedDuration } = parsed.data;

  if (!isDateKey(scheduledDate)) {
    return NextResponse.json(
      { error: "scheduledDate must be a YYYY-MM-DD string" },
      { status: 400 }
    );
  }
  if (startTime !== undefined && (typeof startTime !== "string" || !TIME_RE.test(startTime))) {
    return NextResponse.json({ error: "startTime must be an HH:mm string" }, { status: 400 });
  }
  if (requestedDuration !== undefined && !isDurationMinutes(requestedDuration)) {
    return NextResponse.json(
      { error: "durationMinutes must be a number of minutes between 15 and 1440" },
      { status: 400 }
    );
  }

  await dbConnect();
  const source = await Todo.findOne({ _id: todoId, userId: user._id });
  if (!source) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const durationMinutes = isDurationMinutes(requestedDuration)
    ? requestedDuration
    : (source.durationMinutes ?? DEFAULT_DURATION_MINUTES);
  const copy = await Todo.create({
    ...occurrenceOf(
      source,
      user._id,
      scheduledDate,
      typeof startTime === "string"
        ? startTime
        : await openSlotOn(user._id, scheduledDate, durationMinutes)
    ),
    durationMinutes,
  });
  return NextResponse.json(toJSON(copy), { status: 201 });
}
