/**
 * The default plan's ceilings. Stock limits, not the rolling window in
 * `lib/usage`: these clear only when someone deletes something, so no retry
 * escapes them and every refusal names what to delete. ADR 039.
 */

export type PlanLimits = {
  /** Rows in `documents`, whatever their status — see `countDocuments`. */
  documents: number;
  /** Per reader in one workspace, matching `createChat`'s scope. **Must stay
   * ≥ 1**: `getOrCreateChat` inserts at zero on the chat-turn path, where a
   * refusal would lose the question rather than decline an action. */
  conversations: number;
  /** Rows, not turns — `appendMessages` writes two. Must stay below
   * `MAX_REQUEST_MESSAGES` with room for one more turn, or the transcript guard
   * refuses as a bad body before this cap can name itself. A test holds it. */
  messagesPerConversation: number;
  /** Extracted characters across the workspace — see `sumExtractedCharacters`. */
  extractedCharacters: number;
};

export const DEFAULT_PLAN_LIMITS: PlanLimits = {
  documents: 3,
  conversations: 3,
  // 20 exchanges. A reader resends the whole transcript each turn, so length
  // costs input tokens on every later one.
  messagesPerConversation: 40,
  /* ~325 pages at the seeded handbook's measured density (4,610 characters over
     3 pages), and 24× tighter than the 3 × 4 MB the file-size cap alone allows. */
  extractedCharacters: 500_000,
};

/** Unreachable thresholds rather than a flag that skips enforcement: the count
 * query still runs, so E2E exercises the real admission path. */
export const UNLIMITED_PLAN_LIMITS: PlanLimits = {
  documents: Number.POSITIVE_INFINITY,
  conversations: Number.POSITIVE_INFINITY,
  messagesPerConversation: Number.POSITIVE_INFINITY,
  extractedCharacters: Number.POSITIVE_INFINITY,
};

/** Only the variable actually read — see `UsageLimitsEnv` for why not `ProcessEnv`. */
export type PlanLimitsEnv = {
  PLAN_LIMITS?: string | undefined;
  [key: string]: string | undefined;
};

/** `PLAN_LIMITS=off` is how Playwright opts out: the whole signed-in suite shares
 * one workspace and CI retries twice, so any honest cap would fail the suite for
 * being one. Integration tests run at the real thresholds. */
export function resolvePlanLimits(
  env: PlanLimitsEnv = process.env,
): PlanLimits {
  const configured = env.PLAN_LIMITS?.trim().toLowerCase();

  if (configured === "off") return UNLIMITED_PLAN_LIMITS;
  if (configured === "default") return DEFAULT_PLAN_LIMITS;

  if (configured) {
    throw new Error(
      `Unknown PLAN_LIMITS "${configured}". Expected "default" or "off".`,
    );
  }

  return DEFAULT_PLAN_LIMITS;
}
