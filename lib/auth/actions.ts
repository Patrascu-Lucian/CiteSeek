"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";

import { GUEST_COOKIE_NAME } from "./cookies";

/**
 * Two kinds of session, and not one operation: a signed-in user has a `sessions`
 * row Auth.js must delete, a guest has only a signed cookie. One "sign out" would
 * either strand the cookie or call Auth.js for a session that never existed.
 * Server actions because both *write* cookies, which a Server Component cannot.
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
