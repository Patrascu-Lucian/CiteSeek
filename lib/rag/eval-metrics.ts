/**
 * Retrieval quality, as arithmetic over character ranges.
 *
 * The golden set records where an answer *should* come from as offsets into the
 * source text rather than as chunk ids, because ids are minted per ingest and a
 * chunking change would invalidate the whole set rather than move it.
 */

export type Span = {
  documentId: string;
  charStart: number;
  charEnd: number;
};

export type Retrieved = Span & {
  /** Cosine distance. Lower is closer. */
  distance: number;
};

/** Half-open, like the offsets `chunks` stores: touching edges do not overlap. */
export function overlaps(a: Span, b: Span): boolean {
  return (
    a.documentId === b.documentId &&
    a.charStart < b.charEnd &&
    b.charStart < a.charEnd
  );
}

export type QueryScore = {
  /** Expected passages that some retrieved chunk covers. */
  recall: number;
  /** Retrieved chunks that cover some expected passage. */
  precision: number;
  /** 1/rank of the first useful chunk, or 0. Rewards putting it first, which is
   * what a reader sees as `[1]`. */
  reciprocalRank: number;
};

export function scoreQuery(
  expected: readonly Span[],
  retrieved: readonly Retrieved[],
  k: number,
): QueryScore {
  const top = retrieved.slice(0, k);

  if (expected.length === 0) {
    // An unanswerable question has nothing to recall. Precision is still
    // meaningful — everything returned is wrong — so it is reported as 0.
    return {
      recall: 1,
      precision: top.length === 0 ? 1 : 0,
      reciprocalRank: 0,
    };
  }

  const covered = expected.filter((want) =>
    top.some((got) => overlaps(want, got)),
  ).length;

  const useful = top.filter((got) =>
    expected.some((want) => overlaps(want, got)),
  ).length;

  const firstUseful = top.findIndex((got) =>
    expected.some((want) => overlaps(want, got)),
  );

  return {
    recall: covered / expected.length,
    precision: top.length === 0 ? 0 : useful / top.length,
    reciprocalRank: firstUseful === -1 ? 0 : 1 / (firstUseful + 1),
  };
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export type FloorCase = {
  /** False for a question the corpus cannot answer, which the floor exists to
   * refuse. A set of only answerable questions measures half the job. */
  answerable: boolean;
  retrieved: readonly Retrieved[];
};

export type FloorPoint = {
  maxDistance: number;
  /** Answerable questions this floor would refuse. */
  falseRefusals: number;
  /** Unanswerable questions it would let reach the model. */
  falseAccepts: number;
  answerable: number;
  unanswerable: number;
};

/**
 * What each candidate floor would do to the same retrievals.
 *
 * The two error columns move in opposite directions, so there is no threshold
 * that minimizes both — the number to ship is a choice about which mistake costs
 * more, and this is the table that makes the trade visible.
 */
export function sweepFloor(
  cases: readonly FloorCase[],
  thresholds: readonly number[],
): FloorPoint[] {
  const answerable = cases.filter((one) => one.answerable).length;

  return thresholds.map((maxDistance) => {
    let falseRefusals = 0;
    let falseAccepts = 0;

    for (const one of cases) {
      const admitted = one.retrieved.some(
        (chunk) => chunk.distance <= maxDistance,
      );

      if (one.answerable && !admitted) falseRefusals++;
      if (!one.answerable && admitted) falseAccepts++;
    }

    return {
      maxDistance,
      falseRefusals,
      falseAccepts,
      answerable,
      unanswerable: cases.length - answerable,
    };
  });
}
