"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";

import { GUEST_COOKIE_NAME } from "./cookies";

/**
 * Ending a session.
 *
 * There are two kinds to end, and they are not the same operation. A signed-in
 * user has a row in `sessions` that Auth.js must delete; a guest has only a
 * signed cookie and no server-side state at all. Handling both through one
 * "sign out" would either leave a stale guest cookie behind or call Auth.js for
 * a session that never existed.
 *
 * Server actions rather than route handlers because both need to *write*
 * cookies, which a Server Component cannot do.
 */

export async function signOutAction(): Promise<void> {
  // Clear any guest cookie too. Someone who tried the demo and then signed in
  // carries both; leaving the guest token behind would silently downgrade them
  // to a guest session on the next request rather than signing them out.
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE_NAME);

  await signOut({ redirectTo: "/" });
}

export async function leaveDemoAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE_NAME);

  redirect("/");
}
