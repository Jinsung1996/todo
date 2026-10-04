import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import User from "@/models/User";

// e2e-only login shortcut: never active unless ALLOW_TEST_LOGIN=1 is set
// explicitly (only done by playwright.config.ts's webServer env), so it is a
// 404 in production/dev regardless of auth state.
export async function POST() {
  if (process.env.ALLOW_TEST_LOGIN !== "1") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await dbConnect();
  const user = await User.findOneAndUpdate(
    { githubId: "e2e-test-user" },
    { $set: { username: "e2e-test-user", avatarUrl: "" } },
    { upsert: true, new: true }
  );

  const { token, expiresAt } = await createSession(String(user._id));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
