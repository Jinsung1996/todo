import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { assertTestDatabase } from "@/lib/testDbGuard";
import { addDaysToKey, EVERY_DAY, REPEAT_HORIZON_DAYS, WEEKDAYS } from "@/lib/repeat";
import { extendRepeats } from "@/lib/repeatSync";
import Session from "@/models/Session";
import Todo from "@/models/Todo";
import User from "@/models/User";
import * as todosRoute from "./route";
import * as repeatRoute from "./[todoId]/repeat/route";
import * as todoRoute from "./[todoId]/route";

beforeAll(async () => {
  await dbConnect();
});

afterEach(async () => {
  assertTestDatabase();
  await Promise.all([Session.deleteMany({}), Todo.deleteMany({}), User.deleteMany({})]);
});

async function login(githubId: string) {
  const user = await User.create({ githubId, username: githubId, avatarUrl: "https://example.com/a.png" });
  const { token } = await createSession(String(user._id));
  return (path: string, body?: unknown, method = "POST") =>
    new NextRequest(`http://localhost${path}`, {
      method,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

const params = (todoId: string) => ({ params: Promise.resolve({ todoId }) });
// 2026-10-19 is a Monday.
const MON = "2026-10-19";

async function template(me: Awaited<ReturnType<typeof login>>, title = "점심식사") {
  return (await (await todosRoute.POST(me("/api/todos", { title, isRecurring: true }))).json()) as {
    _id: string;
  };
}

describe("POST /api/todos/[todoId]/repeat", () => {
  it("places a copy on every chosen weekday at the same time, through the horizon", async () => {
    const me = await login("me");
    const lunch = await template(me);

    const res = await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, { from: MON, startTime: "12:00", weekdays: WEEKDAYS }),
      params(lunch._id)
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    const through = addDaysToKey(MON, REPEAT_HORIZON_DAYS);
    expect(body.template.repeat).toEqual({ startTime: "12:00", weekdays: WEEKDAYS, through });

    const copies = await Todo.find({ repeatSourceId: lunch._id }).sort({ scheduledDate: 1 });
    expect(copies).toHaveLength(body.created.length);
    expect(copies[0].scheduledDate).toBe(MON);
    expect(copies.every((c) => c.startTime === "12:00" && !c.isRecurring)).toBe(true);
    const dates = copies.map((c) => c.scheduledDate);
    expect(dates).toContain("2026-10-23"); // 금
    expect(dates).not.toContain("2026-10-24"); // 토
    expect(dates).not.toContain("2026-10-25"); // 일
    expect(dates.at(-1)! <= through).toBe(true);
  });

  it("always places the dropped-on day, and replacing the rule clears the old copies ahead", async () => {
    const me = await login("me");
    const lunch = await template(me);
    const SAT = "2026-10-24";

    await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, { from: SAT, startTime: "12:00", weekdays: WEEKDAYS }),
      params(lunch._id)
    );
    expect(await Todo.countDocuments({ repeatSourceId: lunch._id, scheduledDate: SAT })).toBe(1);

    // A started copy survives the change; untouched ones are replaced.
    await Todo.updateOne(
      { repeatSourceId: lunch._id, scheduledDate: "2026-10-27" },
      { $set: { status: "DOING" } }
    );
    await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, { from: "2026-10-26", startTime: "13:00", weekdays: [3] }),
      params(lunch._id)
    );
    const after = await Todo.find({ repeatSourceId: lunch._id, scheduledDate: { $gte: "2026-10-26" } });
    expect(after.find((c) => c.scheduledDate === "2026-10-26")?.startTime).toBe("13:00");
    expect(after.find((c) => c.scheduledDate === "2026-10-27")?.status).toBe("DOING");
    expect(after.find((c) => c.scheduledDate === "2026-10-28")?.startTime).toBe("13:00"); // 수
    expect(after.some((c) => c.scheduledDate === "2026-10-29")).toBe(false); // 목, old rule
  });

  it("rejects bad input, non-templates and other users' todos", async () => {
    const me = await login("me");
    const her = await login("her");
    const lunch = await template(me);
    const plain = (await (await todosRoute.POST(me("/api/todos", { title: "회의" }))).json()) as {
      _id: string;
    };
    const ok = { from: MON, startTime: "12:00", weekdays: EVERY_DAY };

    for (const bad of [
      { ...ok, weekdays: [] },
      { ...ok, weekdays: [7] },
      { ...ok, from: "2026-13-01" },
      { ...ok, startTime: "25:00" },
    ]) {
      const res = await repeatRoute.POST(me(`/api/todos/${lunch._id}/repeat`, bad), params(lunch._id));
      expect(res.status).toBe(400);
    }
    expect(
      (await repeatRoute.POST(me(`/api/todos/${plain._id}/repeat`, ok), params(plain._id))).status
    ).toBe(400);
    expect(
      (await repeatRoute.POST(her(`/api/todos/${lunch._id}/repeat`, ok), params(lunch._id))).status
    ).toBe(404);
    expect(await Todo.countDocuments({ repeatSourceId: { $exists: true } })).toBe(0);
  });
});

describe("stopping a repeat", () => {
  it("DELETE removes the rule and only the untouched copies after `after`", async () => {
    const me = await login("me");
    const lunch = await template(me);
    await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, { from: MON, startTime: "12:00", weekdays: EVERY_DAY }),
      params(lunch._id)
    );
    await Todo.updateOne(
      { repeatSourceId: lunch._id, scheduledDate: "2026-10-22" },
      { $set: { status: "DONE" } }
    );

    const res = await repeatRoute.DELETE(
      me(`/api/todos/${lunch._id}/repeat?after=2026-10-20`, undefined, "DELETE"),
      params(lunch._id)
    );
    expect(res.status).toBe(200);
    expect((await res.json()).repeat ?? null).toBeNull();
    const left = (await Todo.find({ repeatSourceId: lunch._id })).map((c) => c.scheduledDate).sort();
    expect(left).toEqual([MON, "2026-10-20", "2026-10-22"]);
  });

  it("deleting the template, or making it non-recurring, clears the copies ahead", async () => {
    const me = await login("me");
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const a = await template(me, "아침");
    const b = await template(me, "저녁");
    for (const t of [a, b]) {
      await repeatRoute.POST(
        me(`/api/todos/${t._id}/repeat`, { from: key, startTime: "08:00", weekdays: EVERY_DAY }),
        params(t._id)
      );
    }

    await todoRoute.DELETE(me(`/api/todos/${a._id}`, undefined, "DELETE"), params(a._id));
    await todoRoute.PATCH(me(`/api/todos/${b._id}`, { isRecurring: false }, "PATCH"), params(b._id));

    for (const t of [a, b]) {
      expect(await Todo.countDocuments({ repeatSourceId: t._id, scheduledDate: { $gt: key } })).toBe(0);
      expect(await Todo.countDocuments({ repeatSourceId: t._id, scheduledDate: key })).toBe(1);
    }
    expect((await Todo.findById(b._id))?.repeat ?? null).toBeNull();
  });
});

describe("extendRepeats", () => {
  it("slides the window forward without duplicating or recreating removed days", async () => {
    const me = await login("me");
    const user = await User.findOne({ githubId: "me" });
    const lunch = await template(me);
    await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, { from: MON, startTime: "12:00", weekdays: EVERY_DAY }),
      params(lunch._id)
    );
    // The user removed one day by hand.
    await Todo.deleteOne({ repeatSourceId: lunch._id, scheduledDate: "2026-10-21" });
    const before = await Todo.countDocuments({ repeatSourceId: lunch._id });

    const sevenDaysLater = addDaysToKey(MON, 7);
    await Promise.all([
      extendRepeats(user!._id, sevenDaysLater),
      extendRepeats(user!._id, sevenDaysLater),
    ]);

    const target = addDaysToKey(sevenDaysLater, REPEAT_HORIZON_DAYS);
    expect((await Todo.findById(lunch._id))?.repeat?.through).toBe(target);
    expect(await Todo.countDocuments({ repeatSourceId: lunch._id })).toBe(before + 7);
    expect(await Todo.countDocuments({ repeatSourceId: lunch._id, scheduledDate: "2026-10-21" })).toBe(0);
    expect(await Todo.countDocuments({ repeatSourceId: lunch._id, scheduledDate: target })).toBe(1);
  });
});

describe("PATCH /api/todos/[todoId]/repeat", () => {
  it("moves every untouched copy from `from` on, and swaps the days that changed", async () => {
    const me = await login("me");
    const lunch = await template(me);
    await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, {
        from: MON,
        startTime: "12:00",
        durationMinutes: 60,
        weekdays: [1, 3, 5],
      }),
      params(lunch._id)
    );
    // Started, and removed by hand: both stay as they are.
    await Todo.updateOne(
      { repeatSourceId: lunch._id, scheduledDate: "2026-10-28" },
      { $set: { status: "DOING" } }
    );
    await Todo.deleteOne({ repeatSourceId: lunch._id, scheduledDate: "2026-10-30" });

    const res = await repeatRoute.PATCH(
      me(
        `/api/todos/${lunch._id}/repeat`,
        { from: "2026-10-26", startTime: "12:30", durationMinutes: 90, weekdays: [1, 2, 5] },
        "PATCH"
      ),
      params(lunch._id)
    );
    expect(res.status).toBe(200);
    expect((await res.json()).repeat).toMatchObject({ startTime: "12:30", weekdays: [1, 2, 5] });

    const byDate = new Map(
      (await Todo.find({ repeatSourceId: lunch._id })).map((c) => [c.scheduledDate, c])
    );
    expect(byDate.get(MON)?.startTime).toBe("12:00"); // before `from`
    expect(byDate.get("2026-10-26")).toMatchObject({ startTime: "12:30", durationMinutes: 90 });
    expect(byDate.get("2026-10-27")).toMatchObject({ startTime: "12:30", durationMinutes: 90 }); // 화, new
    expect(byDate.get("2026-10-28")).toMatchObject({ startTime: "12:00", status: "DOING" }); // 수, started
    expect(byDate.has("2026-11-04")).toBe(false); // 수, no longer chosen
    expect(byDate.has("2026-10-30")).toBe(false); // removed by hand
    expect(byDate.get("2026-11-06")?.startTime).toBe("12:30"); // 금
    // Later windows and copies pick up the new length.
    expect((await Todo.findById(lunch._id))?.durationMinutes).toBe(90);
  });

  it("rejects a todo that isn't repeating, and bad fields", async () => {
    const me = await login("me");
    const lunch = await template(me);
    const notRepeating = await repeatRoute.PATCH(
      me(`/api/todos/${lunch._id}/repeat`, { from: MON, startTime: "12:00" }, "PATCH"),
      params(lunch._id)
    );
    expect(notRepeating.status).toBe(400);
    await repeatRoute.POST(
      me(`/api/todos/${lunch._id}/repeat`, { from: MON, startTime: "12:00", weekdays: EVERY_DAY }),
      params(lunch._id)
    );
    for (const bad of [{ startTime: "12:00" }, { from: MON, durationMinutes: 5 }, { from: MON, weekdays: [] }]) {
      const res = await repeatRoute.PATCH(
        me(`/api/todos/${lunch._id}/repeat`, bad, "PATCH"),
        params(lunch._id)
      );
      expect(res.status).toBe(400);
    }
  });
});
