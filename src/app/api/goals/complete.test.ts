import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { assertTestDatabase } from "@/lib/testDbGuard";
import Session from "@/models/Session";
import User from "@/models/User";
import WeeklyPlan from "@/models/WeeklyPlan";
import YearlyGoal from "@/models/YearlyGoal";
import * as goalsRoute from "./route";
import * as goalRoute from "./[goalId]/route";
import * as goalWeeksRoute from "./[goalId]/weeks/route";
import * as weekRoute from "./[goalId]/weeks/[weekId]/route";

beforeAll(async () => {
  await dbConnect();
});

afterEach(async () => {
  assertTestDatabase();
  await Promise.all([
    Session.deleteMany({}),
    User.deleteMany({}),
    WeeklyPlan.deleteMany({}),
    YearlyGoal.deleteMany({}),
  ]);
});

async function login(githubId: string) {
  const user = await User.create({ githubId, username: githubId, avatarUrl: "https://example.com/a.png" });
  const { token } = await createSession(String(user._id));
  return (path: string, init?: { method?: string; body?: unknown }) =>
    new NextRequest(`http://localhost${path}`, {
      method: init?.method ?? "GET",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
}

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

describe("연간/주간 목표 완료", () => {
  it("toggles completed on a goal and a week, starting from false", async () => {
    const me = await login("me");
    const goal = await (
      await goalsRoute.POST(me("/api/goals", { method: "POST", body: { title: "목표", year: 2026 } }))
    ).json();
    expect(goal.completed).toBe(false);

    const done = await goalRoute.PATCH(
      me(`/api/goals/${goal._id}`, { method: "PATCH", body: { completed: true } }),
      params({ goalId: goal._id })
    );
    expect((await done.json()).completed).toBe(true);

    const week = await (
      await goalWeeksRoute.POST(
        me(`/api/goals/${goal._id}/weeks`, {
          method: "POST",
          body: { title: "1주차", weekStart: "2026-11-16", weekEnd: "2026-11-22" },
        }),
        params({ goalId: goal._id })
      )
    ).json();
    expect(week.completed).toBe(false);

    const p = params({ goalId: goal._id, weekId: week._id });
    const path = `/api/goals/${goal._id}/weeks/${week._id}`;
    expect((await (await weekRoute.PATCH(me(path, { method: "PATCH", body: { completed: true } }), p)).json()).completed).toBe(true);
    expect((await (await weekRoute.PATCH(me(path, { method: "PATCH", body: { completed: false } }), p)).json()).completed).toBe(false);
  });

  it("rejects a non-boolean completed", async () => {
    const me = await login("me");
    const goal = await (
      await goalsRoute.POST(me("/api/goals", { method: "POST", body: { title: "목표", year: 2026 } }))
    ).json();
    const res = await goalRoute.PATCH(
      me(`/api/goals/${goal._id}`, { method: "PATCH", body: { completed: "yes" } }),
      params({ goalId: goal._id })
    );
    expect(res.status).toBe(400);
  });

  it("another user cannot complete my goal", async () => {
    const me = await login("me");
    const her = await login("her");
    const goal = await (
      await goalsRoute.POST(me("/api/goals", { method: "POST", body: { title: "목표", year: 2026 } }))
    ).json();
    const res = await goalRoute.PATCH(
      her(`/api/goals/${goal._id}`, { method: "PATCH", body: { completed: true } }),
      params({ goalId: goal._id })
    );
    expect(res.status).toBe(404);
    expect((await YearlyGoal.findById(goal._id))?.completed).toBe(false);
  });
});
