import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents, users } from "@/lib/db/schema";

/**
 * GDPR erasure, as one transaction — the schema was built to make it nearly one
 * statement:
 *
 *   users ─┬─ accounts
 *          ├─ sessions
 *          ├─ workspaces ── documents ── chunks
 *          └─ chats ── messages
 *
 * Structural rather than application code remembering to tidy up: embeddings
 * live in `chunks.embedding` so they go with the row, and text is stored in
 * `documents.contentText` rather than object storage, so nothing orphans
 * (ADR 009). Guests need no equivalent — nothing about one is ever written.
 *
 * `usage_events` needs its own statement: `actor_id` is text rather than a
 * foreign key, because it holds guest ids too, so no cascade reaches it.
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.delete(usageEvents).where(eq(usageEvents.actorId, userId));

    const deleted = await tx
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    return deleted.length > 0;
  });
}
