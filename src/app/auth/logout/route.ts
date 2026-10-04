import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getAppUrl } from "@/lib/appUrl";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(token);

  const response = NextResponse.redirect(new URL("/login", getAppUrl(request)));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
