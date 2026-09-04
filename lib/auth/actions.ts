"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";

import { getActor } from "./actor";
import { GUEST_COOKIE_NAME } from "./cookies";
import { AUTH_PROVIDERS } from "./providers";

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

/**
 * Adding a provider to the account already signed in, which is what makes
 * linking safe: Auth.js attaches it to the current session rather than adopting
 * an account on a matching email, so no provider is trusted to say who someone
 * is (ADR 051).
 */
export async function linkProviderAction(provider: string): Promise<void> {
  // A server action is a public endpoint: the bound argument is encrypted, but
  // the action itself can be called with anything.
  if (!AUTH_PROVIDERS.some(({ id }) => id === provider)) {
    throw new Error(`Unknown sign-in provider ${provider}.`);
  }

  // Without this, linking degrades to an ordinary sign-in.
  const actor = await getActor();
  if (actor?.type !== "user") {
    throw new Error("Linking a provider needs a signed-in session.");
  }

  await signIn(provider, { redirectTo: "/account" });
}
