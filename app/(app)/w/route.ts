import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";
import { getOrCreatePersonalWorkspace } from "@/lib/workspaces/personal";

/**
 * "Take me to my workspace", so no other route needs a workspace id in advance.
 * Creation lives here rather than in a page render: it is the one place a
 * workspace comes into existence, and a handler is the honest home for a write.
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
