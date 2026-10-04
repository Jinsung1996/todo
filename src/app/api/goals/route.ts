import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import YearlyGoal from "@/models/YearlyGoal";
import { toJSON } from "@/lib/serialize";
import { parseJsonBody } from "@/lib/request";

export async function GET() {
  await dbConnect();
  const goals = await YearlyGoal.find().sort({ year: -1, createdAt: -1 });
  return NextResponse.json(toJSON(goals));
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const { title, description, year } = parsed.data;

  if (typeof title !== "string" || !title || typeof year !== "number") {
    return NextResponse.json(
      { error: "title and year are required" },
      { status: 400 }
    );
  }

  await dbConnect();
  const goal = await YearlyGoal.create({
    title,
    description: typeof description === "string" ? description : undefined,
    year,
  });
  return NextResponse.json(toJSON(goal), { status: 201 });
}
