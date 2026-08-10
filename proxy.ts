import { NextResponse, type NextRequest } from "next/server";

import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAMES } from "@/lib/auth/cookies";
import { contentSecurityPolicy } from "@/lib/security/content-security-policy";

/**
 * Two jobs: a Content-Security-Policy on every response, and a cheap credential
 * gate on the signed-in routes.
 *
 * The policy carries a per-request nonce, which is the only way to drop
 * `'unsafe-inline'` from `script-src` — the App Router inlines the RSC payload,
 * and Next applies the nonce to its own scripts when it finds one on the request.
 * The usual objection is that a nonce forces dynamic rendering; measured here it
 * costs nothing, because the theme cookie (ADR 018) had already made all 23
 * routes dynamic and the only static ones are icons.
 *
 * The gate is scoped by `GUARDED` rather than by the matcher, which now has to be
 * wide enough for the policy. It does not verify signatures or touch the database:
 * this is the Edge runtime, and the real decision needs the workspace row anyway.
 *
 * **This is not the authorization boundary.** A cookie with the right name and junk
 * contents gets past it and straight into `getActor()`, which rejects it. Treating
 * the proxy as the boundary is a common and load-bearing mistake.
 */

/** Routes where a missing credential is a redirect rather than a page. */
const GUARDED = [/^\/w(\/|$)/, /^\/account$/];

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());

  // Next reads the nonce off the *request*, not the response.
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);

  const path = request.nextUrl.pathname;
  const guarded = GUARDED.some((pattern) => pattern.test(path));

  const hasCredential =
    SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name)) ||
    request.cookies.has(GUEST_COOKIE_NAME);

  const response =
    guarded && !hasCredential
      ? NextResponse.redirect(signInFor(request))
      : NextResponse.next({ request: { headers } });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));

  return response;
}

function signInFor(request: NextRequest): URL {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set(
    "callbackUrl",
    request.nextUrl.pathname + request.nextUrl.search,
  );

  return signInUrl;
}

/** Everything but the static assets Next serves itself. A guest passes the gate
 * on `/account` and is meant to: they have a credential, and the page explains
 * why a guest session has no account rather than pretending it does not exist. */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
  ],
};
