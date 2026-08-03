"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { THEME_COOKIE_MAX_AGE, THEME_COOKIE_NAME, isTheme } from "./theme";

/**
 * A server action rather than `classList` on the client: the class must be right
 * on the *first byte* of the next response, and only the server can put it there.
 * It also means the control works with JavaScript disabled.
 *
 * `httpOnly` is deliberately **off** — the cookie carries no authority, and a
 * client-side toggle should be able to read it without a round trip.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  const requested = formData.get("theme");

  // Dropped rather than stored: this is echoed into a class name on the root
  // element.
  if (!isTheme(requested)) return;

  const store = await cookies();
  store.set(THEME_COOKIE_NAME, requested, {
    maxAge: THEME_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  // The layout reads the cookie, so every route's markup depends on it.
  revalidatePath("/", "layout");
}
