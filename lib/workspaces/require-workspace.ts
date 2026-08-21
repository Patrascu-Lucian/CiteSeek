import { notFound } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { accessToWorkspace, canWrite } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";

/**
 * The layout and both pages each call this. **A layout is not an authorization
 * boundary** — it and the page it wraps are separate renders, and Next is free
 * to render, skip or reuse either independently.
 */
export async function requireWorkspace(workspaceId: string) {
  const actor = await getActor();
  const workspace = await findWorkspaceById(workspaceId);

  if (!workspace || accessToWorkspace(actor, workspace) === "none") notFound();

  return {
    workspace,
    writable: canWrite(actor, workspace),
    signedIn: actor?.type === "user",
    /** Null for a guest, so callers narrow instead of asserting. */
    userId: actor?.type === "user" ? actor.id : null,
  };
}
