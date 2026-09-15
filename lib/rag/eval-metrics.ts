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

/** A `FloorCase` with what else retrieval already computed for the question. */
export type SignalCase = FloorCase & {
  /** Which set it came from, so a rate is never pooled across sets. */
  set: string;
  /** Top `ts_rank_cd`, or null when no term matched. Higher is better. */
  lexicalTop: number | null;
};

/** Higher reads as "more likely answerable"; null is the weakest reading. */
export type Signal = (one: SignalCase) => number | null;

/** Tightening the distance floor, expressed as a signal: the row any second
 * opinion has to beat. */
export const closeness: Signal = (one) =>
  one.retrieved[0] ? -one.retrieved[0].distance : null;

export const lexicalRank: Signal = (one) => one.lexicalTop;

/** From the closest passage to the k-th. One clear match should open a wider
 * gap than a question that pulls a whole topic at similar distances. */
export function margin(k: number): Signal {
  return (one) => {
    const kth = one.retrieved[k - 1];
    return kth ? kth.distance - one.retrieved[0]!.distance : null;
  };
}

export type SignalCut = {
  /** Answerable refusals the cut was allowed. A tie can leave it spending fewer,
   * so two budgets can produce the same numbers. */
  allowed: number;
  /** Answerable questions the floor admits and this cut would refuse. */
  addedRefusals: number;
  /** Per set: unanswerable questions the floor admits, and how many this cut
   * refuses. */
  removed: Record<string, { removed: number; admitted: number }>;
};

/**
 * A second opinion on what the floor admits. For each number of answerable
 * questions it may refuse, the strictest threshold that refuses no more, and
 * what that threshold removes from each set.
 *
 * In-sample: the threshold is read off the answerable questions it is then
 * scored against.
 */
export function cutSignal(
  cases: readonly SignalCase[],
  maxDistance: number,
  signal: Signal,
  allowedRefusals: readonly number[],
): SignalCut[] {
  const admitted = cases.filter((one) =>
    one.retrieved.some((chunk) => chunk.distance <= maxDistance),
  );
  const read = (one: SignalCase) => signal(one) ?? Number.NEGATIVE_INFINITY;
  const answerable = admitted
    .filter((one) => one.answerable)
    .map(read)
    .sort((a, b) => a - b);

  return allowedRefusals.map((allowed) => {
    // Refusing strictly below the (allowed + 1)-th lowest keeps ties, so a cut
    // never refuses more than it was allowed to.
    const threshold = answerable[allowed] ?? Number.POSITIVE_INFINITY;
    const refused = (one: SignalCase) => read(one) < threshold;
    const removed: SignalCut["removed"] = {};

    for (const one of admitted) {
      if (one.answerable) continue;
      const row = (removed[one.set] ??= { removed: 0, admitted: 0 });
      row.admitted++;
      if (refused(one)) row.removed++;
    }

    return {
      allowed,
      addedRefusals: admitted.filter((one) => one.answerable && refused(one))
        .length,
      removed,
    };
  });
}
