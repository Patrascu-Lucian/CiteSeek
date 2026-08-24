import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { accessToWorkspace, canWrite } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";
import { planUsage } from "@/lib/limits/usage";
import { workspaceUsage } from "@/lib/usage/dashboard";

import { UsageView } from "./usage-view";

export const metadata: Metadata = { title: "Usage" };

/**
 * Workspace-scoped, not per-account: `usage_events` carries a workspace id, while
 * the limit helpers read by *actor* across every workspace — mixing them would
 * show one person's global total on each workspace they can see. Read access is
 * enough, since the demo is read-only and a guest can generate none of it.
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

  const canUpload = canWrite(actor, workspace);

  return (
    <UsageView
      workspaceId={workspace.id}
      usage={await workspaceUsage(workspace.id)}
      canUpload={canUpload}
      // Only where a cap can bite. The demo is read-only for everyone, so a
      // ceiling shown there would describe a limit nobody can reach.
      plan={
        canUpload && actor?.type === "user"
          ? await planUsage(workspace.id, actor.id)
          : null
      }
    />
  );
}
