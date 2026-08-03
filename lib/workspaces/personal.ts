import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { type Workspace, workspaces } from "@/lib/db/schema";

/** Auth.js's adapter creates a `users` row and nothing else, so sign-in worked and
 * then every route bounced the user back to the landing page. */

function personalWorkspaceName(displayName: string | null): string {
  const first = displayName?.trim().split(/\s+/)[0];
  return first ? `${first}'s workspace` : "My workspace";
}

/** Read-only lookup. Returns null rather than creating, for callers that only render. */
export async function findPersonalWorkspace(
  userId: string,
): Promise<Workspace | null> {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.ownerId, userId), eq(workspaces.isDemo, false)))
    // Oldest first, so the answer is stable even if a duplicate were ever created.
    .orderBy(asc(workspaces.createdAt))
    .limit(1);

  return workspace ?? null;
}

/**
 * Idempotent, and looks before it writes: called on first sign-in and again as a
 * self-healing fallback for accounts predating this code.
 *
 * No unique constraint deliberately — one user owning several workspaces is a
 * shape the schema should not rule out, and a constraint here would have to be
 * dropped to allow it. Concurrent first-requests could create two rows; the
 * `orderBy` means both still resolve to the same one.
 */
export async function getOrCreatePersonalWorkspace(user: {
  id: string;
  name: string | null;
}): Promise<Workspace> {
  const existing = await findPersonalWorkspace(user.id);
  if (existing) return existing;

  const [created] = await db
    .insert(workspaces)
    .values({
      name: personalWorkspaceName(user.name),
      ownerId: user.id,
      isDemo: false,
    })
    .returning();

  return created!;
}
