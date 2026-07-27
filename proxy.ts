import { NextResponse, type NextRequest } from "next/server";

import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAMES } from "@/lib/auth/cookies";

/**
 * A cheap first gate on /w/*: does the request carry *any* credential? If not,
 * redirect to sign-in rather than letting the page render an error.
 *
 * Formerly `middleware.ts`. Next 16 renamed the convention to `proxy` precisely
 * to discourage treating it as Express-style middleware, and its docs recommend
 * avoiding it unless nothing else fits. This use qualifies: turning the common
 * signed-out case into a redirect needs to happen before the route renders, and
 * there is no cheaper place to do it.
 *
 * It deliberately does not verify signatures or touch the database. This runs on
 * the Edge runtime on every matched request -- no `node:crypto`, no database
 * driver -- and the real decision needs the workspace row anyway. The
 * authoritative check is in the page: `getActor()` verifies the HMAC and
 * `accessToWorkspace()` decides.
 *
 * Worth being explicit about: this is *not* the authorization boundary. Setting
 * a cookie with the right name and junk contents gets past this and straight
 * into the real check, which rejects it. Treating the proxy as the security
 * boundary is a common and load-bearing mistake.
 */
export function proxy(request: NextRequest) {
  const hasCredential =
    SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name)) ||
    request.cookies.has(GUEST_COOKIE_NAME);

  if (hasCredential) return NextResponse.next();

  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set(
    "callbackUrl",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  return NextResponse.redirect(signInUrl);
}

export const config = {
  matcher: ["/w/:path*"],
};
