import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGithubAuthorizeUrl } from "@/lib/github";
import { getAppUrl } from "@/lib/appUrl";

export const OAUTH_STATE_COOKIE_NAME = "oauth_state";

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${getAppUrl(request)}/auth/github/callback`;

  const response = NextResponse.redirect(getGithubAuthorizeUrl(redirectUri, state));
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60, // 10 minutes
  });
  return response;
}
