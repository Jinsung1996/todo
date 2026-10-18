import { dbConnect } from "@/lib/mongodb";
import Todo from "@/models/Todo";
import User from "@/models/User";
import WeeklyPlan from "@/models/WeeklyPlan";
import YearlyGoal from "@/models/YearlyGoal";

/** Claims all pre-auth todos (no userId set) for the given user. Returns the count claimed. */
export async function claimOrphanTodos(userId: string): Promise<number> {
  await dbConnect();
  const result = await Todo.updateMany(
    { userId: { $exists: false } },
    { $set: { userId } }
  );
  return result.modifiedCount;
}

/**
 * Assigns an owner to 연간/주간 목표 created before goals were per-user (no
 * userId set) — until then every account saw and edited one shared list.
 * Ownership is inferred from whoever owns the todos under the goal's weeks;
 * a goal with no owned todos falls back to the earliest-created user, i.e.
 * the original single-user owner. Returns the number of goals claimed.
 */
export async function claimOrphanGoals(): Promise<number> {
  await dbConnect();
  const orphans = await YearlyGoal.find({ userId: { $exists: false } });
  if (orphans.length === 0) return 0;

  const fallbackOwner = await User.findOne().sort({ createdAt: 1 });
  let claimed = 0;
  for (const goal of orphans) {
    const weeks = await WeeklyPlan.find({ yearlyGoalId: goal._id }).select("_id");
    const ownedTodo = await Todo.findOne({
      weeklyPlanId: { $in: weeks.map((w) => w._id) },
      userId: { $exists: true },
    })
      .sort({ createdAt: 1 })
      .select("userId");
    const ownerId = ownedTodo?.userId ?? fallbackOwner?._id;
    if (!ownerId) continue;

    await YearlyGoal.updateOne({ _id: goal._id }, { $set: { userId: ownerId } });
    await WeeklyPlan.updateMany(
      { yearlyGoalId: goal._id, userId: { $exists: false } },
      { $set: { userId: ownerId } }
    );
    claimed++;
  }
  return claimed;
}

let orphanGoalsClaim: Promise<unknown> | null = null;

/** Runs claimOrphanGoals once per server process; retried on failure. */
export function ensureOrphanGoalsClaimed(): Promise<unknown> {
  orphanGoalsClaim ??= claimOrphanGoals().catch((err) => {
    orphanGoalsClaim = null;
    throw err;
  });
  return orphanGoalsClaim;
}
