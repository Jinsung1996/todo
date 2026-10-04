import type { NextRequest } from "next/server";

/**
 * Base URL used to build the GitHub OAuth redirect_uri. Behind a proxy
 * (e.g. Vercel) the request's inferred origin can occasionally mismatch
 * what's registered on GitHub (protocol/host quirks), so an explicit
 * APP_URL env var always wins when set.
 */
export function getAppUrl(request: NextRequest): string {
  return (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/$/, "");
}
