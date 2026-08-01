import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { accessToWorkspace, canWrite } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";
import { workspaceUsage } from "@/lib/usage/dashboard";

import { UsageView } from "./usage-view";

export const metadata: Metadata = { title: "Usage" };

/**
 * What this workspace has spent.
 *
 * Workspace-scoped rather than per-account, because that is the question the
 * data answers: `usage_events` carries a workspace id, and the limit helpers
 * that read by *actor* deliberately span every workspace — mixing the two would
 * show one person's global total on each workspace they can see.
 *
 * Read access is enough. Usage is a fact about a workspace, and a guest reading
 * the demo may see what the demo has spent; what they cannot do is generate any,
 * since the demo is read-only for everyone.
 */
export default async function UsagePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const actor = await getActor();
  const workspace = await findWorkspaceById(workspaceId);

  if (!workspace || accessToWorkspace(actor, workspace) === "none") {
    notFound();
  }

  return (
    <UsageView
      workspaceId={workspace.id}
      usage={await workspaceUsage(workspace.id)}
      canUpload={canWrite(actor, workspace)}
    />
  );
}
