import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { dbConnect } from "./mongodb";
import { claimOrphanGoals, claimOrphanTodos } from "./migration";
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

describe("claimOrphanGoals", () => {
  async function makeUser(githubId: string) {
    return User.create({ githubId, username: githubId, avatarUrl: "https://example.com/a.png" });
  }

  it("gives a legacy goal (and its weeks) to whoever owns the todos under it", async () => {
    await makeUser("owner-first");
    const todoOwner = await makeUser("todo-owner");
    const week = await makeWeeklyPlan();
    await Todo.create({ title: "t", weeklyPlanId: week._id, userId: todoOwner._id });

    expect(await claimOrphanGoals()).toBe(1);

    const goal = await YearlyGoal.findById(week.yearlyGoalId);
    const reloadedWeek = await WeeklyPlan.findById(week._id);
    expect(String(goal?.userId)).toBe(String(todoOwner._id));
    expect(String(reloadedWeek?.userId)).toBe(String(todoOwner._id));
  });

  it("falls back to the earliest user for a legacy goal with no owned todos", async () => {
    const original = await makeUser("original");
    await makeUser("later");
    await YearlyGoal.create({ title: "empty", year: 2026 });

    expect(await claimOrphanGoals()).toBe(1);
    const goal = await YearlyGoal.findOne({ title: "empty" });
    expect(String(goal?.userId)).toBe(String(original._id));
  });

  it("does not touch goals that already have an owner", async () => {
    await makeUser("original");
    const other = await makeUser("other");
    await YearlyGoal.create({ title: "theirs", year: 2026, userId: other._id });

    expect(await claimOrphanGoals()).toBe(0);
    const goal = await YearlyGoal.findOne({ title: "theirs" });
    expect(String(goal?.userId)).toBe(String(other._id));
  });
});
