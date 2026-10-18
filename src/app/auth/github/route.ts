import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGithubAuthorizeUrl } from "@/lib/github";
import { getAppUrl } from "@/lib/appUrl";

export const OAUTH_STATE_COOKIE_NAME = "oauth_state";

export async function GET(request: NextRequest) {
  const appUrl = getAppUrl(request);

  // The oauth_state cookie set below is scoped to whatever host the browser
  // is on right now. GitHub always redirects back to the fixed redirect_uri
  // built from APP_URL, so a user who reaches this route via a different
  // host (e.g. Vercel's auto-assigned *.vercel.app domain, an old preview
  // alias, or www vs. apex) would get a cookie that never reaches the
  // callback host — every login attempt then fails with "invalid OAuth
  // state". Normalize to the canonical host first so the cookie and the
  // callback always land on the same place.
  if (request.nextUrl.origin !== appUrl) {
    return NextResponse.redirect(`${appUrl}/auth/github`);
  }

  try {
    const state = randomBytes(16).toString("hex");
    const redirectUri = `${appUrl}/auth/github/callback`;

    const response = NextResponse.redirect(getGithubAuthorizeUrl(redirectUri, state));
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60, // 10 minutes
    });
    return response;
  } catch (err) {
    console.error("Failed to start GitHub OAuth flow:", err);
    const url = new URL("/login", appUrl);
    url.searchParams.set("error", "github_login_failed");
    return NextResponse.redirect(url);
  }
}
