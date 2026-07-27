import { NextResponse } from "next/server";

import { findDemoWorkspace } from "@/lib/auth/demo";
import {
  GUEST_COOKIE_NAME,
  GUEST_SESSION_MAX_AGE_SECONDS,
  createGuestToken,
} from "@/lib/auth/guest";

/**
 * Entry point for guest mode.
 *
 * A GET that sets a cookie is normally a smell, but this is a navigation target
 * from a link and it creates no server-side state -- the token is self-contained
 * and nothing is written to the database. Requiring a POST would mean an
 * interstitial between "click Try the demo" and seeing the product, which is
 * precisely the friction the demo exists to remove.
 *
 * Redirect targets are derived from `request.url` rather than an env var so this
 * works unchanged on localhost, Vercel previews, and production.
 */
export async function GET(request: Request) {
  const secret = process.env.AUTH_SECRET;

  // Misconfiguration, not user error. Better to explain than to issue an
  // unsigned cookie that nothing would accept.
  if (!secret) {
    return NextResponse.redirect(new URL("/demo-unavailable", request.url));
  }

  let workspace: Awaited<ReturnType<typeof findDemoWorkspace>>;

  try {
    workspace = await findDemoWorkspace();
  } catch {
    // Database unreachable or un-migrated. The demo link should degrade into an
    // explanation rather than a 500.
    return NextResponse.redirect(new URL("/demo-unavailable", request.url));
  }

  if (!workspace) {
    return NextResponse.redirect(new URL("/demo-unavailable", request.url));
  }

  const response = NextResponse.redirect(
    new URL(`/w/${workspace.id}`, request.url),
  );

  response.cookies.set({
    name: GUEST_COOKIE_NAME,
    value: createGuestToken(secret),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
