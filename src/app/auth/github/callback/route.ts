import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { exchangeCodeForToken, fetchGithubUser } from "@/lib/github";
import { claimOrphanTodos } from "@/lib/migration";
import User from "@/models/User";
import { OAUTH_STATE_COOKIE_NAME } from "@/app/auth/github/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.json({ error: "invalid OAuth state" }, { status: 401 });
  }

  await dbConnect();

  const accessToken = await exchangeCodeForToken(code);
  const githubUser = await fetchGithubUser(accessToken);

  const existing = await User.findOne({ githubId: String(githubUser.id) });
  const isFirstLogin = !existing;

  const user = await User.findOneAndUpdate(
    { githubId: String(githubUser.id) },
    {
      $set: {
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
      },
    },
    { upsert: true, new: true }
  );

  if (isFirstLogin) {
    await claimOrphanTodos(String(user._id));
  }

  const { token, expiresAt } = await createSession(String(user._id));

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  return response;
}
