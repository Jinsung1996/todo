import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { dbConnect } from "./mongodb";
import { claimOrphanTodos } from "./migration";
import { assertTestDatabase } from "./testDbGuard";
import Todo from "@/models/Todo";
import User from "@/models/User";
import WeeklyPlan from "@/models/WeeklyPlan";
import YearlyGoal from "@/models/YearlyGoal";

beforeAll(async () => {
  await dbConnect();
});

afterEach(async () => {
  assertTestDatabase();
  await Todo.deleteMany({});
  await User.deleteMany({});
  await WeeklyPlan.deleteMany({});
  await YearlyGoal.deleteMany({});
});

async function makeWeeklyPlan() {
  const goal = await YearlyGoal.create({ title: "goal", year: 2026 });
  return WeeklyPlan.create({
    title: "week",
    weekStart: new Date(),
    weekEnd: new Date(),
    yearlyGoalId: goal._id,
  });
}

describe("claimOrphanTodos", () => {
  it("assigns userId to todos that have none, and reports the count claimed", async () => {
    const week = await makeWeeklyPlan();
    await Todo.create({ title: "legacy 1", weeklyPlanId: week._id });
    await Todo.create({ title: "legacy 2", weeklyPlanId: week._id });

    const user = await User.create({
      githubId: "1",
      username: "octocat",
      avatarUrl: "https://example.com/a.png",
    });

    const claimed = await claimOrphanTodos(String(user._id));
    expect(claimed).toBe(2);

    const todos = await Todo.find({});
    for (const t of todos) {
      expect(String(t.userId)).toBe(String(user._id));
    }
  });

  it("does not touch todos that already belong to a user", async () => {
    const week = await makeWeeklyPlan();
    const existingOwner = await User.create({
      githubId: "1",
      username: "owner",
      avatarUrl: "https://example.com/a.png",
    });
    await Todo.create({ title: "owned", weeklyPlanId: week._id, userId: existingOwner._id });

    const newUser = await User.create({
      githubId: "2",
      username: "newcomer",
      avatarUrl: "https://example.com/b.png",
    });
    const claimed = await claimOrphanTodos(String(newUser._id));
    expect(claimed).toBe(0);

    const todo = await Todo.findOne({ title: "owned" });
    expect(String(todo?.userId)).toBe(String(existingOwner._id));
  });

  it("is a no-op (claims 0) when there are no orphan todos", async () => {
    const user = await User.create({
      githubId: "1",
      username: "octocat",
      avatarUrl: "https://example.com/a.png",
    });
    expect(await claimOrphanTodos(String(user._id))).toBe(0);
  });
});
