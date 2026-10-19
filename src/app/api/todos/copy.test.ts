import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { assertTestDatabase } from "@/lib/testDbGuard";
import Session from "@/models/Session";
import Todo from "@/models/Todo";
import User from "@/models/User";
import * as todosRoute from "./route";
import * as copyRoute from "./[todoId]/copy/route";

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
  return (path: string, body: unknown) =>
    new NextRequest(`http://localhost${path}`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      body: JSON.stringify(body),
    });
}

const params = (todoId: string) => ({ params: Promise.resolve({ todoId }) });

describe("POST /api/todos/[todoId]/copy", () => {
  it("places another occurrence at the given time, leaving the source untouched", async () => {
    const me = await login("me");
    const source = await (
      await todosRoute.POST(me("/api/todos", { title: "점심식사", isRecurring: true }))
    ).json();

    const res = await copyRoute.POST(
      me(`/api/todos/${source._id}/copy`, { scheduledDate: "2026-10-21", startTime: "12:00" }),
      params(source._id)
    );
    expect(res.status).toBe(201);
    const copy = await res.json();
    expect(copy).toMatchObject({
      title: "점심식사",
      scheduledDate: "2026-10-21",
      startTime: "12:00",
      isRecurring: false,
      status: "TODO",
    });
    expect(copy._id).not.toBe(source._id);

    const reloaded = await Todo.findById(source._id);
    expect(reloaded?.isRecurring).toBe(true);
    expect(reloaded?.scheduledDate ?? null).toBeNull();
  });

  it("auto-fills the next open slot when no time is given", async () => {
    const me = await login("me");
    const study = await (
      await todosRoute.POST(me("/api/todos", { title: "공부", scheduledDate: "2026-10-21" }))
    ).json();
    expect(study.startTime).toBe("07:00");

    const copy = await (
      await copyRoute.POST(
        me(`/api/todos/${study._id}/copy`, { scheduledDate: "2026-10-21" }),
        params(study._id)
      )
    ).json();
    expect(copy.startTime).toBe("08:00");
  });

  it("refuses to copy another user's todo, and rejects a bad date", async () => {
    const me = await login("me");
    const her = await login("her");
    const mine = await (await todosRoute.POST(me("/api/todos", { title: "비밀 약속" }))).json();

    const stolen = await copyRoute.POST(
      her(`/api/todos/${mine._id}/copy`, { scheduledDate: "2026-10-21" }),
      params(mine._id)
    );
    expect(stolen.status).toBe(404);

    const bad = await copyRoute.POST(
      me(`/api/todos/${mine._id}/copy`, { scheduledDate: "tomorrow" }),
      params(mine._id)
    );
    expect(bad.status).toBe(400);
    expect(await Todo.countDocuments({})).toBe(1);
  });
});
