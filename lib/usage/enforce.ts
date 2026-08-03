import { NextResponse } from "next/server";

import type { AuthorizedWorkspace } from "@/lib/documents/authorize";

import { resolveUsageLimits, type UsageLimitsEnv } from "./config";
import {
  RATE_WINDOW_SECONDS,
  decideUsage,
  refusalBody,
  type RefusalBody,
} from "./limits";
import { countAllRequestsSince, countRequestsSince } from "./queries";

/**
 * Admission, not settlement: refusing *after* the provider call would meter the
 * request it was meant to prevent. Runs after `authorizeWorkspace`, so a 404 for
 * a workspace you cannot see is never turned into a 429 revealing it exists.
 *
 * Not in `proxy.ts` — middleware is Edge, the Postgres client is Node-only, and
 * that constraint already caused one production outage.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Re-exported under the name route callers already use. */
export type UsageRefusalBody = RefusalBody;

/** A guest is counted by address — `/demo` mints a fresh cookie per visit, so a
 * self-assigned identity is worthless as a limit key. ADR 014. */
function countingKey(
  auth: Pick<AuthorizedWorkspace, "actorType" | "actorId">,
  ipHash: string,
): { actorId: string } | { ipHash: string } {
  return auth.actorType === "guest" ? { ipHash } : { actorId: auth.actorId };
}

/** A 429 to hand back, or `null` to proceed — the shape `isDenied` uses, so a
 * caller cannot accidentally continue past a refusal. */
export async function enforceUsageLimits(
  auth: Pick<AuthorizedWorkspace, "actorType" | "actorId">,
  ipHash: string,
  // Annotated: inferring widens to `ProcessEnv`, which demands `NODE_ENV`.
  env: UsageLimitsEnv = process.env,
): Promise<NextResponse<UsageRefusalBody> | null> {
  const limits = resolveUsageLimits(env);
  const key = countingKey(auth, ipHash);

  const now = Date.now();
  const minuteAgo = new Date(now - RATE_WINDOW_SECONDS * 1000);
  const dayAgo = new Date(now - DAY_MS);

  // Issued together: independent scans, and serializing adds two round trips to
  // every admitted request.
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

  return NextResponse.json(refusalBody(decision.reason), {
    status: 429,
    headers,
  });
}
