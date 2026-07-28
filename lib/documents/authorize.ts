import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { canRead, canWrite } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";

/**
 * The authorization preamble every document route runs.
 *
 * Centralized so the check cannot be forgotten on a new route and cannot drift
 * between routes — the two ways this sort of guard usually fails.
 *
 * **Not-found and denied return the identical response.** Distinguishing them
 * would let anyone probe which workspace ids exist by comparing a 404 with a
 * 403. The same reasoning already applies in the workspace page.
 */

const DENIED = { error: "Workspace not found." } as const;

export function deniedResponse() {
  return NextResponse.json(DENIED, { status: 404 });
}

export type AuthorizedWorkspace = {
  workspaceId: string;
  actorType: "user" | "guest";
  actorId: string;
};

/**
 * Resolves the caller and checks their access to a workspace.
 *
 * Returns a `NextResponse` on failure so callers can `if ("status" in result)`
 * and return it directly, rather than reconstructing the same error shape.
 */
export async function authorizeWorkspace(
  workspaceId: string,
  access: "read" | "write",
): Promise<AuthorizedWorkspace | NextResponse> {
  const actor = await getActor();
  if (!actor) return deniedResponse();

  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) return deniedResponse();

  const permitted =
    access === "write" ? canWrite(actor, workspace) : canRead(actor, workspace);

  if (!permitted) return deniedResponse();

  return {
    workspaceId: workspace.id,
    actorType: actor.type,
    actorId: actor.id,
  };
}

export function isDenied(
  result: AuthorizedWorkspace | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
