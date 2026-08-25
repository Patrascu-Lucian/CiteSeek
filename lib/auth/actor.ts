import { cookies } from "next/headers";

import { auth } from "@/auth";

import { type Actor } from "./authorization";
import { GUEST_COOKIE_NAME, verifyGuestToken } from "./guest";

/**
 * The single place the app asks "who is this request?", hiding both mechanisms —
 * Auth.js and a signed guest cookie. Nothing calls `auth()` directly, which is
 * what keeps ADR 004's exit path realistic. A real session wins over a guest
 * cookie, since a stale demo cookie often outlives signing in.
 */
export async function getActor(): Promise<Actor> {
  const session = await auth();

  if (session?.user?.id) {
    return {
      type: "user",
      id: session.user.id,
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    };
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  const result = verifyGuestToken(token, secret);

  return result.ok ? { type: "guest", id: result.payload.id } : null;
}

export { type Actor };
