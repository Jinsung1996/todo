import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { dbConnect } from "./mongodb";
import { createSession, destroySession, getSessionFromToken } from "./auth";
import { assertTestDatabase } from "./testDbGuard";
import User from "@/models/User";
import Session from "@/models/Session";

beforeAll(async () => {
  await dbConnect();
});

afterEach(async () => {
  assertTestDatabase();
  await User.deleteMany({});
  await Session.deleteMany({});
});

async function makeUser() {
  return User.create({
    githubId: "12345",
    username: "octocat",
    avatarUrl: "https://example.com/avatar.png",
  });
}

describe("createSession / getSessionFromToken", () => {
  it("creates a session that resolves back to the owning user", async () => {
    const user = await makeUser();
    const { token } = await createSession(String(user._id));

    const result = await getSessionFromToken(token);
    expect(result).not.toBeNull();
    expect(result?.user.username).toBe("octocat");
  });

  it("returns null for a token that does not exist", async () => {
    const result = await getSessionFromToken("nonexistent-token");
    expect(result).toBeNull();
  });

  it("returns null and deletes the record for an expired session", async () => {
    const user = await makeUser();
    const expired = await Session.create({
      token: "expired-token",
      userId: user._id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await getSessionFromToken("expired-token");
    expect(result).toBeNull();

    const stillThere = await Session.findById(expired._id);
    expect(stillThere).toBeNull();
  });

  it("returns null for an undefined/missing token", async () => {
    expect(await getSessionFromToken(undefined)).toBeNull();
    expect(await getSessionFromToken(null)).toBeNull();
  });
});

describe("destroySession", () => {
  it("removes the session document so the token no longer resolves", async () => {
    const user = await makeUser();
    const { token } = await createSession(String(user._id));

    expect(await getSessionFromToken(token)).not.toBeNull();

    await destroySession(token);

    expect(await getSessionFromToken(token)).toBeNull();
    expect(await Session.findOne({ token })).toBeNull();
  });

  it("is a no-op for a missing token (does not throw)", async () => {
    await expect(destroySession(undefined)).resolves.not.toThrow();
  });
});
