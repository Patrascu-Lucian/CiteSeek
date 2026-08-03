import { and, count, eq, gte, lt, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

/**
 * Three questions, one table, three indexes. Every read is a range scan over a
 * window, so `created_at` trails in each index rather than leading.
 *
 * Deliberately **not** workspace-scoped: a limit counting usage inside one
 * workspace is escaped by making another. The scope is the actor, or for a guest
 * the address. Dashboard reads are the opposite question — about a place — and
 * live in `dashboard.ts`. Do not widen these to take a workspace.
 */

/** Longer than the widest cap window (a day) and enough for the dashboard's
 * month. Past that a row answers nothing, and keeping a hashed address to answer
 * nothing is not defensible. */
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

/** Resolves rather than throws: a succeeded request must not fail because its
 * accounting row did not land. The caller is told, because unrecorded usage means
 * every cap silently stops applying. */
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

/** Unkeyed so it uses `usage_events_created_at_idx` — this runs on every admitted
 * request and is the only query whose cost grows with total traffic. */
export async function countAllRequestsSince(since: Date): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(usageEvents)
    .where(gte(usageEvents.createdAt, since));

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

/** Swept from a request path rather than a cron — no scheduler exists, and adding
 * one for a `DELETE` is a lot of infrastructure. Postgres computes the cutoff, so
 * it cannot drift with clock skew. */
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
