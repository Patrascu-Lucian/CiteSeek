import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * GDPR erasure, as one statement — the schema was built to make it one:
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
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  const deleted = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return deleted.length > 0;
}
