import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { type Workspace, workspaces } from "@/lib/db/schema";

/**
 * A signed-in user's own workspace.
 *
 * Auth.js's adapter creates a `users` row and nothing else, so without this a
 * successful sign-in leaves the account with nowhere to go. That was the actual
 * bug: sign-in worked, then every route sent the user back to the landing page
 * because no workspace existed to send them to.
 */

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
 * Idempotent. Called from `events.createUser` on first sign-in, and again as a
 * self-healing fallback for accounts that predate this code -- which is why it
 * looks before it writes rather than relying on the signup path alone.
 *
 * There is no unique constraint backing this, deliberately: Milestone 4 adds
 * multiple workspaces per user, and a constraint here would have to be dropped
 * again. Two concurrent first-requests could therefore create two rows; the
 * `orderBy` above means both would still resolve to the same one afterwards.
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
