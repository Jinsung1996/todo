import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Todo from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";
import { isValidObjectId } from "@/lib/objectId";
import { getCurrentUser } from "@/lib/currentUser";
import { DEFAULT_DURATION_MINUTES, isDateKey, TIME_RE } from "@/lib/schedule";
import { openSlotOn } from "@/lib/autoSlot";
import { addDaysToKey, isWeekdayList, REPEAT_HORIZON_DAYS, repeatDates } from "@/lib/repeat";
import { placeRepeatCopies, removeUpcomingCopies } from "@/lib/repeatSync";

type Params = { params: Promise<{ todoId: string }> };

async function findTemplate(request: NextRequest, todoId: string) {
  if (!isValidObjectId(todoId)) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  const user = await getCurrentUser(request);
  if (!user) {
    return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  await dbConnect();
  const template = await Todo.findOne({ _id: todoId, userId: user._id });
  if (!template) {
    return { error: NextResponse.json({ error: "not found" }, { status: 404 }) };
  }
  if (!template.isRecurring) {
    return {
      error: NextResponse.json({ error: "only a recurring todo can repeat" }, { status: 400 }),
    };
  }
  return { user, template };
}

// A 🔁 template dropped on the calendar with "앞으로도 같은 시간에": places
// it on `from` (the day it was dropped on) and on every chosen weekday
// after that, at the same time. Setting a new rule replaces the old one.
export async function POST(request: NextRequest, { params }: Params) {
  const { todoId } = await params;
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { from, startTime, weekdays } = parsed.data;

  if (!isDateKey(from)) {
    return NextResponse.json({ error: "from must be a YYYY-MM-DD string" }, { status: 400 });
  }
  if (startTime !== undefined && (typeof startTime !== "string" || !TIME_RE.test(startTime))) {
    return NextResponse.json({ error: "startTime must be an HH:mm string" }, { status: 400 });
  }
  if (!isWeekdayList(weekdays)) {
    return NextResponse.json(
      { error: "weekdays must list 1–7 distinct days, 0 (일) to 6 (토)" },
      { status: 400 }
    );
  }

  const found = await findTemplate(request, todoId);
  if (found.error) return found.error;
  const { user, template } = found;

  const time =
    typeof startTime === "string"
      ? startTime
      : await openSlotOn(
          user._id,
          from,
          template.durationMinutes ?? DEFAULT_DURATION_MINUTES
        );
  if (template.repeat) {
    await removeUpcomingCopies(template._id, user._id, addDaysToKey(from, -1));
  }

  const through = addDaysToKey(from, REPEAT_HORIZON_DAYS);
  template.repeat = { startTime: time, weekdays, through };
  await template.save();
  // The dropped-on day always gets one, even if it isn't a chosen weekday.
  const dates = [...new Set([from, ...repeatDates(weekdays, from, through)])];
  const created = await placeRepeatCopies(template, user._id, dates, time);
  return NextResponse.json(toJSON({ template, created }), { status: 201 });
}

// "반복 중지": drops the rule and the not-yet-started copies after `after`
// (the caller's today, so today's own copy stays).
export async function DELETE(request: NextRequest, { params }: Params) {
  const { todoId } = await params;
  const after = request.nextUrl.searchParams.get("after");
  if (!isDateKey(after)) {
    return NextResponse.json({ error: "after must be a YYYY-MM-DD string" }, { status: 400 });
  }
  const found = await findTemplate(request, todoId);
  if (found.error) return found.error;
  const { user, template } = found;

  await removeUpcomingCopies(template._id, user._id, after);
  template.repeat = undefined;
  await template.save();
  return NextResponse.json(toJSON(template));
}
