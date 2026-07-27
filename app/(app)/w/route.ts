import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";
import { getOrCreatePersonalWorkspace } from "@/lib/workspaces/personal";

/**
 * "Take me to my workspace."
 *
 * A single entry point that resolves whoever is asking to the right workspace,
 * so no other route has to know a user's workspace id in advance. Sign-in
 * redirects here, and so does `/sign-in` when someone already signed in lands on
 * it.
 *
 * Creation lives here rather than in a page render: this is the one place a
 * workspace may be brought into existence, and a route handler is the honest
 * home for a request that writes.
 */
export async function GET(request: Request) {
  const actor = await getActor();

  if (actor?.type === "user") {
    const workspace = await getOrCreatePersonalWorkspace({
      id: actor.id,
      name: actor.name,
    });
    return NextResponse.redirect(new URL(`/w/${workspace.id}`, request.url));
  }

  if (actor?.type === "guest") {
    const demo = await findDemoWorkspace();
    if (demo) {
      return NextResponse.redirect(new URL(`/w/${demo.id}`, request.url));
    }
    return NextResponse.redirect(new URL("/demo-unavailable", request.url));
  }

  return NextResponse.redirect(
    new URL("/sign-in?callbackUrl=%2Fw", request.url),
  );
}
