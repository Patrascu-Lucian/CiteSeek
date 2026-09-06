import { and, count, eq, gte, lt, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import type { usageKind } from "@/lib/db/schema";
import { usageEvents } from "@/lib/db/schema";

/** Never workspace-scoped: a limit counted inside one workspace is escaped by
 * making another. Reads about a *place* are the other question, in `dashboard.ts`. */

/** A day covers the widest cap, a month covers the dashboard. Past that the row
 * answers nothing, and keeping a hashed address to answer nothing is not defensible. */
export const RETENTION_DAYS = 30;

/** Derived, not retyped: the pgEnum is the list, and a second copy here would
 * compile while the migration and the union disagreed. */
export type UsageKind = (typeof usageKind.enumValues)[number];

/** `"anonymous"` is not an `ActorType`: it has no session and no workspace, and
 * the only thing identifying it is the hash it is also counted by. Widened here
 * rather than in `lib/auth`, so nothing downstream starts treating it as an
 * actor that can be authorized. */
export type UsageActor = "user" | "guest" | "anonymous";

export type UsageEventInput = {
  actorType: UsageActor;
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

/** The only query whose cost grows with total traffic, and it runs on every
 * admitted request — hence unkeyed, on `usage_events_created_at_idx`. */
/** Filtered by kind: a guest on the demo shares an `ipHash` with a stranger
 * asking for links, and either would spend the other's allowance. */
export async function countSignInLinksSince(
  ipHash: string,
  since: Date,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.ipHash, ipHash),
        eq(usageEvents.kind, "sign_in_link"),
        gte(usageEvents.createdAt, since),
      ),
    );

  return row?.total ?? 0;
}

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
