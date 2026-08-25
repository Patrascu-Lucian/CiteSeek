import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { canRead, canWrite } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";

/**
 * The authorization preamble every workspace-scoped route runs.
 *
 * **Not-found and denied return the identical response**, or anyone could probe
 * which workspace ids exist by comparing a 404 with a 403.
 */

const DENIED = { error: "Workspace not found." } as const;

export function deniedResponse() {
  return NextResponse.json(DENIED, { status: 404 });
}

export type AuthorizedWorkspace = {
  workspaceId: string;
  actorType: "user" | "guest";
  actorId: string;
  /** For read-authorized routes that still write. Not `actorType`: a signed-in
   * reader of the demo is a user who may not write (ADR 040). */
  canWrite: boolean;
};

export type AuthorizedWrite = AuthorizedWorkspace & {
  actorType: "user";
  canWrite: true;
};

/** `"read"` is the right to ask; `"write"` is the right to leave something behind. */
export async function authorizeWorkspace(
  workspaceId: string,
  access: "write",
): Promise<AuthorizedWrite | NextResponse>;
export async function authorizeWorkspace(
  workspaceId: string,
  access: "read",
): Promise<AuthorizedWorkspace | NextResponse>;
export async function authorizeWorkspace(
  workspaceId: string,
  access: "read" | "write",
): Promise<AuthorizedWorkspace | NextResponse> {
  const actor = await getActor();
  if (!actor) return deniedResponse();

  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) return deniedResponse();

  // Two branches, not a ternary: a guard inside a ternary narrows nothing.
  if (access === "write") {
    if (!canWrite(actor, workspace)) return deniedResponse();

    return {
      workspaceId: workspace.id,
      actorType: actor.type,
      actorId: actor.id,
      canWrite: true,
    };
  }

  if (!canRead(actor, workspace)) return deniedResponse();

  return {
    workspaceId: workspace.id,
    actorType: actor.type,
    actorId: actor.id,
    canWrite: canWrite(actor, workspace),
  };
}

export function isDenied(
  result: AuthorizedWorkspace | NextResponse,
): result is NextResponse {
  return result instanceof NextResponse;
}
