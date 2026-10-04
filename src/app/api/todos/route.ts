import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Todo from "@/models/Todo";
import { toJSON } from "@/lib/serialize";
import { getCurrentUser } from "@/lib/currentUser";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status");
  const scheduledDate = request.nextUrl.searchParams.get("scheduledDate");
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();

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
