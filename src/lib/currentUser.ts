import type { NextRequest } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromToken(token);
  return session?.user ?? null;
}
