import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { assertTestDatabase } from "@/lib/testDbGuard";
import Session from "@/models/Session";
import Todo from "@/models/Todo";
import User from "@/models/User";
import WeeklyPlan from "@/models/WeeklyPlan";
import YearlyGoal from "@/models/YearlyGoal";
import * as goalsRoute from "./route";
import * as goalRoute from "./[goalId]/route";
import * as goalWeeksRoute from "./[goalId]/weeks/route";
import * as weeksRoute from "@/app/api/weeks/route";

beforeAll(async () => {
  await dbConnect();
});

afterEach(async () => {
  assertTestDatabase();
  await Promise.all([
    Session.deleteMany({}),
    Todo.deleteMany({}),
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

describe("연간/주간 목표 are private to their owner", () => {
  it("another user can neither list, read, edit, delete nor add weeks to my goal", async () => {
    const me = await login("me");
    const her = await login("her");

    const created = await goalsRoute.POST(
      me("/api/goals", { method: "POST", body: { title: "내 목표", year: 2026 } })
    );
    const goal = await created.json();
    await goalWeeksRoute.POST(
      me(`/api/goals/${goal._id}/weeks`, {
        method: "POST",
        body: { title: "1주차", weekStart: "2026-10-19", weekEnd: "2026-10-25" },
      }),
      params({ goalId: goal._id })
    );

    expect(await (await goalsRoute.GET(me("/api/goals"))).json()).toHaveLength(1);
    expect(await (await weeksRoute.GET(me("/api/weeks"))).json()).toHaveLength(1);

    expect(await (await goalsRoute.GET(her("/api/goals"))).json()).toEqual([]);
    expect(await (await weeksRoute.GET(her("/api/weeks"))).json()).toEqual([]);
    expect(
      await (await goalWeeksRoute.GET(her(`/api/goals/${goal._id}/weeks`), params({ goalId: goal._id }))).json()
    ).toEqual([]);
    expect((await goalRoute.GET(her(`/api/goals/${goal._id}`), params({ goalId: goal._id }))).status).toBe(404);
    expect(
      (
        await goalRoute.PATCH(
          her(`/api/goals/${goal._id}`, { method: "PATCH", body: { title: "hijacked" } }),
          params({ goalId: goal._id })
        )
      ).status
    ).toBe(404);
    expect(
      (
        await goalWeeksRoute.POST(
          her(`/api/goals/${goal._id}/weeks`, {
            method: "POST",
            body: { title: "x", weekStart: "2026-10-19", weekEnd: "2026-10-25" },
          }),
          params({ goalId: goal._id })
        )
      ).status
    ).toBe(404);
    expect(
      (await goalRoute.DELETE(her(`/api/goals/${goal._id}`, { method: "DELETE" }), params({ goalId: goal._id })))
        .status
    ).toBe(404);

    const stillMine = await YearlyGoal.findById(goal._id);
    expect(stillMine?.title).toBe("내 목표");
  });

  it("rejects unauthenticated requests", async () => {
    const res = await goalsRoute.GET(new NextRequest("http://localhost/api/goals"));
    expect(res.status).toBe(401);
  });
});
