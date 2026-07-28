import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * GDPR right to erasure.
 *
 * One statement, because the schema was built to make it one: every table that
 * holds a user's data references them through a chain of `ON DELETE CASCADE`
 * foreign keys.
 *
 *   users ─┬─ accounts
 *          ├─ sessions
 *          ├─ workspaces ── documents ── chunks
 *          └─ chats ── messages
 *
 * The roadmap's "deleting a document removes file, chunks, AND embeddings" is
 * satisfied structurally rather than by application code remembering to tidy up:
 * embeddings live in `chunks.embedding`, so they go with the chunk row. And
 * because extracted text is stored in `documents.contentText` rather than as
 * uploaded files in object storage, there is nothing left behind to orphan —
 * see ADR 009.
 *
 * Guest sessions need no equivalent: their token is self-contained and signed,
 * and nothing about a guest is ever written to the database.
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  const deleted = await db
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return deleted.length > 0;
}
