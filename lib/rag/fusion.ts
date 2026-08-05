/**
 * Reciprocal rank fusion: **positions, not scores**. A cosine distance and a
 * `ts_rank_cd` are different kinds of number, and normalizing them into one range
 * invents a comparison neither supports. Measured and rejected — ADR 021.
 */

/** Damping. Large enough that second-on-both beats first-on-one. */
export const RRF_K = 60;

export type Ranked = { id: string };

export type Fused<T> = {
  item: T;
  score: number;
  /** 1-based position in each list that returned it, for explaining a result. */
  ranks: Partial<Record<string, number>>;
};

/**
 * Higher is better, unlike the distances everywhere else in retrieval — this is
 * a relevance score, not a metric.
 */
export function fuse<T extends Ranked>(
  lists: Readonly<Record<string, readonly T[]>>,
  /** Per-list multiplier, defaulting to 1. A list weighted 0 contributes nothing,
   * which is how the evaluation puts "vector only" on the same sweep as every
   * blend rather than beside it as a second code path. */
  weights: Readonly<Record<string, number>> = {},
): Fused<T>[] {
  const byId = new Map<string, Fused<T>>();

  for (const [name, list] of Object.entries(lists)) {
    const weight = weights[name] ?? 1;
    if (weight === 0) continue;

    list.forEach((item, index) => {
      const rank = index + 1;
      const contribution = weight / (RRF_K + rank);
      const existing = byId.get(item.id);

      if (existing) {
        existing.score += contribution;
        existing.ranks[name] = rank;
        return;
      }

      byId.set(item.id, { item, score: contribution, ranks: { [name]: rank } });
    });
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}
