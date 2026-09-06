import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents, users, verificationTokens } from "@/lib/db/schema";

/** Two tables need their own statement, because neither is keyed on a user:
 * `usage_events.actor_id` also holds guest ids, and a sign-in link is asked for
 * before any user row exists. Everything else cascades (ADR 009). */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx.delete(usageEvents).where(eq(usageEvents.actorId, userId));

    // Read before the row goes: the token's identifier is the address, and the
    // address is on the row this deletes.
    const [account] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    if (account?.email) {
      // Lowercased, because Auth.js normalizes an identifier before storing it
      // while an OAuth profile supplies `users.email` untouched — so the two
      // differ in case for anyone who signed in with a provider first.
      await tx
        .delete(verificationTokens)
        .where(eq(verificationTokens.identifier, account.email.toLowerCase()));
    }

    const deleted = await tx
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    return deleted.length > 0;
  });
}
