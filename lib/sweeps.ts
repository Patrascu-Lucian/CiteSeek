/**
 * Housekeeping writes ride on a request because no scheduler exists. The
 * documents list polls every two seconds during ingestion, so an unguarded sweep
 * is a write per poll on an endpoint nobody reads as a write.
 */

/**
 * Runs `work` at most once per interval, and returns whether it ran.
 *
 * Takes the work rather than answering "is it due?": a predicate that mutates
 * can be read twice and acted on once, and the interval must advance only once
 * the work **succeeds** — a sweep that throws would otherwise burn its window.
 * `performance.now()` is monotonic, so a backward clock step cannot hold the
 * gate shut. State is per process.
 */
export function atMostEvery(
  intervalMs: number,
  now: () => number = () => performance.now(),
): (work: () => Promise<unknown>) => Promise<boolean> {
  let last = -Infinity;

  return async (work) => {
    const at = now();
    if (at - last < intervalMs) return false;

    await work();
    last = at;
    return true;
  };
}

/** Documents are presumed dead only after 10 minutes, so a minute of extra
 * latency before one is marked failed is immaterial. */
export const sweepStaleDocuments = atMostEvery(60_000);

/** Retention is counted in days. */
export const pruneOldUsage = atMostEvery(60 * 60_000);
