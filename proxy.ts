import { NextResponse, type NextRequest } from "next/server";

import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAMES } from "@/lib/auth/cookies";
import { MAINTENANCE_PATH, maintenanceOn } from "@/lib/maintenance";
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
  const path = request.nextUrl.pathname;
  const held = maintenanceOn() && path !== MAINTENANCE_PATH;
  const policy = contentSecurityPolicy(btoa(crypto.randomUUID()), {
    path: held ? MAINTENANCE_PATH : path,
  });

  // On the request, because Next reads the nonce from the request's policy
  // header. It also copies response headers onto the request, so the response
  // header alone works too, but that copy is not a documented contract.
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);

  if (held) {
    const holding = NextResponse.rewrite(
      new URL(MAINTENANCE_PATH, request.url),
      { status: 503, headers: { "Retry-After": "600" }, request: { headers } },
    );

    holding.headers.set("Content-Security-Policy", policy);

    return holding;
  }

  const guarded = GUARDED.some((pattern) => pattern.test(path));

  const hasCredential =
    SESSION_COOKIE_NAMES.some((name) => request.cookies.has(name)) ||
    request.cookies.has(GUEST_COOKIE_NAME);

  const response =
    guarded && !hasCredential
      ? NextResponse.redirect(signInFor(request))
      : NextResponse.next({ request: { headers } });

  response.headers.set("Content-Security-Policy", policy);

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
