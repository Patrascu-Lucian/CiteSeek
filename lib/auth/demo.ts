import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";

/**
 * The seeded demo workspace guests are allowed to read.
 *
 * Returns null rather than throwing when it is absent: a database that has not
 * been seeded is a deployment state the UI should explain, not a crash. The
 * partial unique index on `is_demo` guarantees there is at most one.
 */
export async function findDemoWorkspace() {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      isDemo: workspaces.isDemo,
    })
    .from(workspaces)
    .where(eq(workspaces.isDemo, true))
    .limit(1);

  return workspace ?? null;
}

export async function findWorkspaceById(id: string) {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      isDemo: workspaces.isDemo,
    })
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);

  return workspace ?? null;
}
