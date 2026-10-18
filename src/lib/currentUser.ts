import type { NextRequest } from "next/server";
import { getSessionFromToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { ensureOrphanGoalsClaimed } from "@/lib/migration";

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromToken(token);
  if (!session) return null;
  // Legacy goals must have an owner before any ownership-filtered query runs,
  // or they would silently vanish for everyone.
  await ensureOrphanGoalsClaimed();
  return session.user;
}
