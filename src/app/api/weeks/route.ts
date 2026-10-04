import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import WeeklyPlan from "@/models/WeeklyPlan";
import Todo from "@/models/Todo";
import { weeklyProgress } from "@/lib/progress";
import { toJSON } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/currentUser";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const weeks = await WeeklyPlan.find()
    .populate("yearlyGoalId")
    .sort({ weekStart: -1 });

  const withProgress = await Promise.all(
    weeks.map(async (week) => {
      const todos = await Todo.find({ weeklyPlanId: week._id, userId: user._id });
      return { ...toJSON(week), progress: weeklyProgress(todos) };
    })
  );

  return NextResponse.json(withProgress);
}
