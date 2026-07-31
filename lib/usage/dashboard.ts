import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

import { RETENTION_DAYS } from "./queries";

/**
 * Reading usage back, for the person who spent it.
 *
 * Deliberately a separate module from `queries.ts` rather than more functions in
 * it, because the two ask different questions and the difference is easy to
 * erase by accident:
 *
 * - **Limit reads are actor-scoped and span every workspace.** A cap that only
 *   counted usage inside one workspace would be escaped by making another, which
 *   is why `queries.ts` says its helpers are not workspace-scoped.
 * - **Dashboard reads are workspace-scoped.** "What has this workspace spent" is
 *   a question about a place, and answering it with an actor-scoped helper would
 *   show one member's total on every workspace they belong to.
 *
 * Keeping them apart means neither can be widened into the other by someone
 * adding a parameter that looks harmless.
 */

/** One day's spend. `day` is a UTC calendar date, formatted `YYYY-MM-DD`. */
export type UsageDay = {
  day: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
};

export type WorkspaceUsage = {
  days: UsageDay[];
  totals: { requests: number; inputTokens: number; outputTokens: number };
  /**
   * When the most recent event was recorded, or null if there are none.
   *
   * This is the honest consumer of `recordUsage`'s `{ recorded }` signal, which
   * nothing read until now. If recording ever stops — a permissions change, a
   * connection limit, a missing table — the caps silently stop applying and no
   * error is raised anywhere, because that failure is swallowed by design on the
   * chat path. A visible "last recorded" is what turns that from invisible into
   * merely quiet: a date that stops moving while the app is plainly being used
   * is a signal to the one person who looks at this page.
   */
  lastRecordedAt: Date | null;
  /** The window these numbers cover, bounded by the retention policy. */
  windowDays: number;
};

/**
 * Everything this workspace has spent, grouped by day.
 *
 * **Days are UTC**, via `date_trunc('day', created_at AT TIME ZONE 'UTC')`. A
 * reader in Europe will see an evening's questions counted against the next day
 * for part of the year. That is stated in the interface rather than corrected:
 * doing it properly means carrying the reader's zone into the query and dealing
 * with the fact that a "day" then differs per viewer, which is a bigger feature
 * than a spend summary warrants.
 *
 * The window is `RETENTION_DAYS` because that is the hard bound — rows older
 * than that are deleted by `pruneUsageEvents`, so a longer range would report
 * zeroes and look like a quiet month rather than an absent one.
 */
export async function workspaceUsage(
  workspaceId: string,
): Promise<WorkspaceUsage> {
  const since = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${usageEvents.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
      requests: count(),
      inputTokens: sum(usageEvents.inputTokens),
      outputTokens: sum(usageEvents.outputTokens),
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.workspaceId, workspaceId),
        gte(usageEvents.createdAt, since),
      ),
    )
    .groupBy(
      sql`date_trunc('day', ${usageEvents.createdAt} at time zone 'UTC')`,
    )
    .orderBy(
      desc(sql`date_trunc('day', ${usageEvents.createdAt} at time zone 'UTC')`),
    );

  const [latest] = await db
    .select({ createdAt: usageEvents.createdAt })
    .from(usageEvents)
    .where(eq(usageEvents.workspaceId, workspaceId))
    .orderBy(desc(usageEvents.createdAt))
    .limit(1);

  // `sum` returns null over an empty set and a string over a non-empty one —
  // the same conversion `sumTokensSince` documents.
  const days: UsageDay[] = rows.map((row) => ({
    day: row.day,
    requests: row.requests,
    inputTokens: Number(row.inputTokens ?? 0),
    outputTokens: Number(row.outputTokens ?? 0),
  }));

  return {
    days,
    totals: days.reduce(
      (running, day) => ({
        requests: running.requests + day.requests,
        inputTokens: running.inputTokens + day.inputTokens,
        outputTokens: running.outputTokens + day.outputTokens,
      }),
      { requests: 0, inputTokens: 0, outputTokens: 0 },
    ),
    lastRecordedAt: latest?.createdAt ?? null,
    windowDays: RETENTION_DAYS,
  };
}
