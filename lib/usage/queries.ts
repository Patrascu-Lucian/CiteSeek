import { and, count, eq, gte, lt, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

/**
 * Reading and writing what things cost.
 *
 * Three questions, one table, three indexes. Every read is a range scan over a
 * time window, which is why `created_at` is the trailing column of each index
 * rather than the leading one.
 *
 * Unlike `lib/documents/queries.ts` these are not workspace-scoped, and
 * deliberately so: a limit that only counted a caller's usage *inside one
 * workspace* would be trivially escaped by making another. The scope here is the
 * actor, and for a guest the address they arrive from.
 */

/**
 * How long a row is worth keeping.
 *
 * Comfortably longer than the widest window any cap looks back over (a day), and
 * long enough for Milestone 4's usage dashboard to draw a month. Past that a row
 * answers no question anyone asks, and keeping a hashed address forever to
 * answer nothing is not a defensible position.
 */
export const RETENTION_DAYS = 30;

export type UsageKind = "chat" | "embedding";

export type UsageEventInput = {
  actorType: "user" | "guest";
  actorId: string;
  ipHash: string | null;
  workspaceId: string | null;
  kind: UsageKind;
  inputTokens?: number;
  outputTokens?: number;
};

/**
 * Records one metered event.
 *
 * Resolves rather than throws when the insert fails. A request that has already
 * succeeded must not be turned into an error because its accounting row did not
 * land — but the caller is told, because usage silently failing to record means
 * every cap silently stops applying, and a safety mechanism that fails quietly
 * is worse than one that is absent.
 */
export async function recordUsage(
  event: UsageEventInput,
): Promise<{ recorded: boolean }> {
  try {
    await db.insert(usageEvents).values({
      actorType: event.actorType,
      actorId: event.actorId,
      ipHash: event.ipHash,
      workspaceId: event.workspaceId,
      kind: event.kind,
      requests: 1,
      inputTokens: event.inputTokens ?? 0,
      outputTokens: event.outputTokens ?? 0,
    });

    return { recorded: true };
  } catch {
    // Deliberately no error detail: this runs on the chat path, and the quality
    // bar forbids logging anything that could carry message content.
    return { recorded: false };
  }
}

/** Requests by one caller since a moment — the rate-limit question. */
export async function countRequestsSince(
  key: { actorId: string } | { ipHash: string },
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(usageEvents)
    .where(
      and(
        "actorId" in key
          ? eq(usageEvents.actorId, key.actorId)
          : eq(usageEvents.ipHash, key.ipHash),
        gte(usageEvents.createdAt, since),
      ),
    );

  return row?.total ?? 0;
}

/** Tokens spent by one caller since a moment — the personal cap. */
export async function sumTokensSince(
  key: { actorId: string } | { ipHash: string },
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({
      total: sum(
        sql<number>`${usageEvents.inputTokens} + ${usageEvents.outputTokens}`,
      ),
    })
    .from(usageEvents)
    .where(
      and(
        "actorId" in key
          ? eq(usageEvents.actorId, key.actorId)
          : eq(usageEvents.ipHash, key.ipHash),
        gte(usageEvents.createdAt, since),
      ),
    );

  // `sum` returns null over an empty set and a string over a non-empty one.
  return Number(row?.total ?? 0);
}

/** Tokens spent by everyone since a moment — the global cap. */
export async function sumAllTokensSince(since: Date): Promise<number> {
  const [row] = await db
    .select({
      total: sum(
        sql<number>`${usageEvents.inputTokens} + ${usageEvents.outputTokens}`,
      ),
    })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since));

  return Number(row?.total ?? 0);
}

/**
 * Deletes rows past the retention window.
 *
 * Swept from a request path rather than a cron, the same way
 * `failStaleProcessing` is: this project has no scheduler, and adding one to
 * delete a few rows would be a lot of infrastructure for a `DELETE`. The cutoff
 * is computed by Postgres, not the app, so it cannot drift with clock skew.
 */
export async function pruneUsageEvents(): Promise<number> {
  const deleted = await db
    .delete(usageEvents)
    .where(
      lt(
        usageEvents.createdAt,
        sql`now() - make_interval(days => ${RETENTION_DAYS})`,
      ),
    )
    .returning({ id: usageEvents.id });

  return deleted.length;
}
