import { NextResponse } from "next/server";

import type { AuthorizedWorkspace } from "@/lib/documents/authorize";

import { resolveUsageLimits, type UsageLimitsEnv } from "./config";
import {
  RATE_WINDOW_SECONDS,
  decideUsage,
  refusalMessage,
  type LimitRefusal,
} from "./limits";
import { countAllRequestsSince, countRequestsSince } from "./queries";

/**
 * The admission check every metered route runs, straight after authorization.
 *
 * Admission-based rather than settled afterward: the point is to refuse *before*
 * spending a provider call, and a check that ran at the end would meter the very
 * request it was meant to prevent. It sits after `authorizeWorkspace` so an
 * unauthorized caller is refused on the cheaper ground first — and so a 404 for a
 * workspace you cannot see is never turned into a 429 that reveals it exists.
 *
 * Not in `proxy.ts`: middleware runs on Edge, the Postgres client is Node-only,
 * and that exact constraint already caused one production outage. Enforcement
 * lives in the route handlers, which declare `runtime = "nodejs"`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type UsageRefusalBody = {
  error: string;
  code: LimitRefusal;
};

/**
 * How a caller is counted.
 *
 * A guest is counted by the address they arrive from, because `/demo` mints a
 * fresh signed cookie on every visit and a self-assigned identity is worthless
 * as a limit key. A signed-in user is counted by their user id, which they
 * cannot mint more of. See ADR 014.
 */
function countingKey(
  auth: Pick<AuthorizedWorkspace, "actorType" | "actorId">,
  ipHash: string,
): { actorId: string } | { ipHash: string } {
  return auth.actorType === "guest" ? { ipHash } : { actorId: auth.actorId };
}

/**
 * Returns a 429 to hand straight back, or `null` when the request may proceed.
 *
 * The `null`-means-allowed shape mirrors `isDenied`: the caller writes one
 * guard clause and cannot accidentally continue past a refusal.
 */
export async function enforceUsageLimits(
  auth: Pick<AuthorizedWorkspace, "actorType" | "actorId">,
  ipHash: string,
  // Annotated rather than inferred from the default: `process.env` widens to
  // `ProcessEnv`, which demands `NODE_ENV` and would force every caller to
  // supply an irrelevant value. Same reason `ProviderEnv` exists.
  env: UsageLimitsEnv = process.env,
): Promise<NextResponse<UsageRefusalBody> | null> {
  const limits = resolveUsageLimits(env);
  const key = countingKey(auth, ipHash);

  const now = Date.now();
  const minuteAgo = new Date(now - RATE_WINDOW_SECONDS * 1000);
  const dayAgo = new Date(now - DAY_MS);

  // Three independent range scans, issued together rather than in sequence:
  // they do not depend on each other, and serializing them would add two round
  // trips to every admitted request.
  const [requestsInLastMinute, requestsToday, globalRequestsToday] =
    await Promise.all([
      countRequestsSince(key, minuteAgo),
      countRequestsSince(key, dayAgo),
      countAllRequestsSince(dayAgo),
    ]);

  const decision = decideUsage(
    {
      actorType: auth.actorType,
      requestsInLastMinute,
      requestsToday,
      globalRequestsToday,
    },
    limits,
  );

  if (decision.allowed) return null;

  const headers =
    decision.reason === "rate_limited"
      ? { "Retry-After": String(decision.retryAfterSeconds) }
      : undefined;

  return NextResponse.json(
    { error: refusalMessage(decision.reason), code: decision.reason },
    { status: 429, headers },
  );
}
