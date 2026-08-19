import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { isUuid } from "@/lib/db/uuid";
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

/**
 * Note on the "no unscoped query helpers" rule: this looks like a violation and
 * is deliberately the exception. It queries the `workspaces` table itself in
 * order to *establish* the scope — the caller must still pass the result through
 * `accessToWorkspace()` before doing anything with it. Every helper that reads
 * workspace-owned data (documents, chunks, chats) takes a workspace id and
 * filters on it in SQL; those arrive in Milestone 1.
 */
export async function findWorkspaceById(id: string) {
  if (!isUuid(id)) return null;

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
