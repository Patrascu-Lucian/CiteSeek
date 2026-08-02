"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { THEME_COOKIE_MAX_AGE, THEME_COOKIE_NAME, isTheme } from "./theme";

/**
 * Records a reader's theme choice.
 *
 * A server action rather than `document.documentElement.classList` on the
 * client, for the reason the whole design rests on: the class has to be right on
 * the *first byte* of the next response, and only the server can put it there.
 * Writing it on the client would work for the current page and flash on the
 * next one.
 *
 * It also means the control works with JavaScript disabled — the form posts,
 * the cookie is set, the page comes back in the new palette. Progressive
 * enhancement is close to free here and a theme toggle is a reasonable thing to
 * expect to work in a hardened browser.
 *
 * `httpOnly` is deliberately **off**: this cookie carries no authority, and a
 * future client-side toggle should be able to read it without a round trip.
 * `sameSite: lax` and no `secure` in development for the same reasons as the
 * guest cookie.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  const requested = formData.get("theme");

  // An unrecognized value is dropped rather than stored. The cookie is echoed
  // into a class name on the root element, so what may be written there is
  // worth being strict about.
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
