import { randomBytes } from "crypto";
import { dbConnect } from "@/lib/mongodb";
import Session from "@/models/Session";
import User, { type UserDoc } from "@/models/User";

export const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string) {
  await dbConnect();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await Session.create({ token, userId, expiresAt });
  return { token, expiresAt: session.expiresAt };
}

export async function getSessionFromToken(
  token: string | undefined | null
): Promise<{ user: UserDoc & { _id: string }; sessionToken: string } | null> {
  if (!token) return null;
  await dbConnect();
  const session = await Session.findOne({ token });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }
  const user = await User.findById(session.userId);
  if (!user) return null;
  return { user: user as unknown as UserDoc & { _id: string }, sessionToken: token };
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await dbConnect();
  await Session.deleteOne({ token });
}
