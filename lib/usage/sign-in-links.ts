import { and, count, eq, gte, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

/** The one caller with no session and no workspace. `usage_events.actor_type`
 * and `actor_id` are both `notNull`, and the hash is the only identity such a
 * caller has — the same value the count is keyed on. */
const ANONYMOUS = "anonymous";

export const SIGN_IN_LINK_WINDOW_SECONDS = 60 * 60;

/** A reader needs one, and two more if the first went to spam. A script needs
 * thousands. Shared egress — an office, a mobile carrier — is the case this
 * number is unfair to, and the trade is deliberate (ADR 053). */
export const SIGN_IN_LINKS_PER_HOUR = 5;

/**
 * Counts and records in one transaction, so the count cannot change underneath
 * the decision: a script has no reason to await, and requests arriving together
 * would each read four and each send. `createQueuedDocumentUnless` is the same
 * shape for the same reason — there, `for update` on the workspace row; here
 * there is no row belonging to this caller, so the advisory lock is keyed on the
 * hash and serializes that caller alone.
 *
 * Keyed on the caller, never on the address asked for: counting per recipient
 * would let anyone lock a chosen person out by spending their allowance.
 */
export async function admitSignInLink(ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - SIGN_IN_LINK_WINDOW_SECONDS * 1000);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${ipHash})::bigint)`,
    );

    const [row] = await tx
      .select({ total: count() })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.ipHash, ipHash),
          eq(usageEvents.kind, "sign_in_link"),
          gte(usageEvents.createdAt, since),
        ),
      );

    if ((row?.total ?? 0) >= SIGN_IN_LINKS_PER_HOUR) return false;

    // Recorded before the send returns, not after: a provider that is slow or
    // failing must not become a way to exceed the allowance.
    await tx.insert(usageEvents).values({
      actorType: ANONYMOUS,
      actorId: ipHash,
      ipHash,
      workspaceId: null,
      kind: "sign_in_link",
    });

    return true;
  });
}
