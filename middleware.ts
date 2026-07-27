import { NextResponse, type NextRequest } from "next/server";

import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAMES } from "@/lib/auth/cookies";

/**
 * A cheap first gate on /w/*: does the request carry *any* credential? If not,
 * redirect to sign-in rather than letting the page render an error.
 *
 * It deliberately does not verify signatures or touch the database. Middleware
 * runs on the Edge runtime on every matched request — it has no `node:crypto`
 * and no database driver — and the real decision needs the workspace row anyway.
 * The authoritative check is in the page: `getActor()` verifies the HMAC, and
 * `accessToWorkspace()` decides.
 *
 * Worth being explicit about: this is *not* the authorization boundary. Setting
 * a cookie with the right name and junk contents gets past this and straight
 * into the real check, which rejects it. Treating middleware as the security
 * boundary is a common and load-bearing mistake.
 */
export function middleware(request: NextRequest) {
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
