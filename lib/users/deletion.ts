import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents, users } from "@/lib/db/schema";

/**
 * GDPR erasure in one transaction, because the cascade is structural rather than
 * code remembering to tidy up: embeddings live in `chunks.embedding` and text in
 * `documents.contentText`, so nothing orphans (ADR 009). `usage_events` needs its
 * own statement — `actor_id` is text, not a foreign key, since it holds guest ids.
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
