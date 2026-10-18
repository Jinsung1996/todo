import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { exchangeCodeForToken, fetchGithubUser } from "@/lib/github";
import { claimOrphanTodos } from "@/lib/migration";
import { getAppUrl } from "@/lib/appUrl";
import User, { type UserDoc } from "@/models/User";
import { OAUTH_STATE_COOKIE_NAME } from "@/app/auth/github/route";

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

function loginErrorRedirect(request: NextRequest, code: string) {
  const url = new URL("/login", getAppUrl(request));
  url.searchParams.set("error", code);
  const response = NextResponse.redirect(url);
  // Whatever went wrong, the state cookie served its purpose (or was never
  // valid to begin with) — clear it so a retry starts clean.
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  // The user declined the GitHub authorization prompt, or their org blocked
  // it (e.g. SSO not enrolled). GitHub reports this via ?error=... instead
  // of ?code=..., and the old code fell through to the generic branch below
  // with a confusing "invalid OAuth state" message.
  if (request.nextUrl.searchParams.get("error")) {
    return loginErrorRedirect(request, "github_denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;

  if (!code || !state || !storedState || state !== storedState) {
    return loginErrorRedirect(request, "invalid_state");
  }

  try {
    await dbConnect();

    const accessToken = await exchangeCodeForToken(code);
    const githubUser = await fetchGithubUser(accessToken);
    const githubId = String(githubUser.id);

    let user: (UserDoc & { _id: unknown }) | null;
    let isFirstLogin: boolean;
    try {
      const existing = await User.findOne({ githubId });
      isFirstLogin = !existing;
      user = await User.findOneAndUpdate(
        { githubId },
        { $set: { username: githubUser.login, avatarUrl: githubUser.avatar_url } },
        { upsert: true, new: true }
      );
    } catch (err) {
      // Two near-simultaneous first-time logins for the same GitHub account
      // (double-clicking "GitHub로 로그인", or two tabs) can race this
      // upsert: the second request's insert collides with the unique
      // githubId index and throws instead of returning a document. The
      // first request's row already exists at this point, so fetch it
      // instead of failing the whole login.
      if (isDuplicateKeyError(err)) {
        user = await User.findOne({ githubId });
        isFirstLogin = false;
      } else {
        throw err;
      }
    }

    if (!user) {
      throw new Error("GitHub login: user record missing after upsert");
    }

    if (isFirstLogin) {
      await claimOrphanTodos(String(user._id));
    }

    const { token, expiresAt } = await createSession(String(user._id));

    const response = NextResponse.redirect(new URL("/", getAppUrl(request)));
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch (err) {
    // Anything unexpected here (GitHub API hiccup, DB error, etc.) used to
    // crash with an unhandled 500 and strand the user on a dead page with
    // no way back in. Log it for diagnosis and send them somewhere they can
    // retry from instead.
    console.error("GitHub OAuth callback failed:", err);
    return loginErrorRedirect(request, "github_login_failed");
  }
}
