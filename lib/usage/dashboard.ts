import { and, count, desc, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/lib/db";
import { usageEvents } from "@/lib/db/schema";

import { RETENTION_DAYS } from "./queries";

/**
 * A separate module from `queries.ts` because the two scopes look
 * interchangeable and are not: limit reads are **actor**-scoped across every
 * workspace (a cap counting one workspace is escaped by making another),
 * dashboard reads are **workspace**-scoped. Apart, neither can be widened into
 * the other by a parameter that looks harmless.
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
  /** The honest consumer of `recordUsage`'s `{ recorded }` signal, which nothing
   * read until now. If recording stops, the caps silently stop applying and
   * nothing raises — a date that stops moving is the only signal. */
  lastRecordedAt: Date | null;
  /** The window these numbers cover, bounded by the retention policy. */
  windowDays: number;
};

/**
 * **Days are UTC**, so a European evening's questions land on the next day for
 * part of the year. Stated in the interface rather than corrected: carrying the
 * reader's zone into the query makes a "day" differ per viewer, which is a bigger
 * feature than a spend summary warrants.
 *
 * The window is `RETENTION_DAYS` — the hard bound, since older rows are deleted,
 * so a longer range reports zeroes and looks like a quiet month.
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
