import { describe, expect, it } from "vitest";

import {
  closeness,
  cutSignal,
  lexicalRank,
  margin,
  mean,
  overlaps,
  scoreQuery,
  sweepFloor,
  type Retrieved,
  type SignalCase,
  type Span,
} from "./eval-metrics";

const doc = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

const span = (charStart: number, charEnd: number, documentId = doc): Span => ({
  documentId,
  charStart,
  charEnd,
});

const got = (
  charStart: number,
  charEnd: number,
  distance = 0.3,
  documentId = doc,
): Retrieved => ({ documentId, charStart, charEnd, distance });

describe("overlaps", () => {
  it("is false for touching edges, because the offsets are half-open", () => {
    // A chunk ending exactly where the expected passage begins shares no
    // character with it, and counting it would inflate every recall number.
    expect(overlaps(span(0, 100), span(100, 200))).toBe(false);
    expect(overlaps(span(100, 200), span(0, 100))).toBe(false);
    expect(overlaps(span(0, 100), span(99, 200))).toBe(true);
  });

  it("never matches across documents", () => {
    expect(overlaps(span(0, 100), span(0, 100, other))).toBe(false);
  });
});

describe("scoreQuery", () => {
  it("counts an expected passage as recalled when any chunk covers it", () => {
    // Chunking is a choice the harness must survive: the same passage may arrive
    // as one chunk or split across two, and neither is a retrieval failure.
    const score = scoreQuery(
      [span(100, 200)],
      [got(150, 400), got(900, 1000)],
      5,
    );

    expect(score.recall).toBe(1);
    expect(score.reciprocalRank).toBe(1);
  });

  it("rewards rank, because the reader sees the first chunk as [1]", () => {
    const expected = [span(500, 600)];
    const first = scoreQuery(expected, [got(500, 600), got(0, 100)], 5);
    const third = scoreQuery(
      expected,
      [got(0, 100), got(100, 200), got(500, 600)],
      5,
    );

    expect(first.reciprocalRank).toBe(1);
    expect(third.reciprocalRank).toBeCloseTo(1 / 3);
  });

  it("only counts the top k", () => {
    const score = scoreQuery([span(500, 600)], [got(0, 100), got(500, 600)], 1);

    expect(score.recall).toBe(0);
    expect(score.reciprocalRank).toBe(0);
  });

  it("scores an unanswerable question by whether anything came back", () => {
    // Recall is vacuous with nothing to recall, so precision carries it: the
    // right answer to a question the corpus cannot answer is silence.
    expect(scoreQuery([], [], 5).precision).toBe(1);
    expect(scoreQuery([], [got(0, 100)], 5).precision).toBe(0);
  });

  it("reports precision against what was returned, not against k", () => {
    const score = scoreQuery([span(0, 100)], [got(0, 100), got(900, 1000)], 5);

    expect(score.precision).toBe(0.5);
  });

  it("counts each passage covered and each chunk that covers one", () => {
    // Two of each, so "some" and "every" disagree: one passage is covered, and
    // one chunk covers a passage.
    const score = scoreQuery(
      [span(0, 100), span(500, 600)],
      [got(0, 100), got(900, 1000)],
      5,
    );

    expect(score.recall).toBe(0.5);
    expect(score.precision).toBe(0.5);
    expect(score.reciprocalRank).toBe(1);
  });

  it("scores an answerable question that retrieved nothing as zero, not NaN", () => {
    // A NaN reaches `mean` and blanks a column of the report.
    expect(scoreQuery([span(0, 100)], [], 5)).toEqual({
      recall: 0,
      precision: 0,
      reciprocalRank: 0,
    });
  });
});

describe("mean", () => {
  it("is 0 for nothing, rather than NaN", () => {
    // A NaN here would propagate silently into a reported table.
    expect(mean([])).toBe(0);
  });

  it("averages real values", () => {
    expect(mean([1, 2, 6])).toBe(3);
  });
});

describe("sweepFloor", () => {
  const cases = [
    { answerable: true, retrieved: [got(0, 100, 0.55)] },
    { answerable: true, retrieved: [got(0, 100, 0.75)] },
    { answerable: false, retrieved: [got(0, 100, 0.65)] },
  ];

  it("shows the two errors moving in opposite directions", () => {
    // The whole point of the table: no threshold minimizes both, so the number
    // to ship is a judgment about which mistake costs more.
    const [tight, loose] = sweepFloor(cases, [0.6, 0.8]);

    expect(tight).toMatchObject({ falseRefusals: 1, falseAccepts: 0 });
    expect(loose).toMatchObject({ falseRefusals: 0, falseAccepts: 1 });
  });

  it("counts a question as admitted on its closest chunk alone", () => {
    // The route refuses only when *nothing* clears the floor, so one good chunk
    // among bad ones is an answer.
    const [point] = sweepFloor(
      [{ answerable: true, retrieved: [got(0, 100, 0.9), got(0, 100, 0.4)] }],
      [0.6],
    );

    expect(point?.falseRefusals).toBe(0);
  });

  it("reports the denominators, so a rate is not inferred from the wrong total", () => {
    const [point] = sweepFloor(cases, [0.6]);

    expect(point).toMatchObject({ answerable: 2, unanswerable: 1 });
  });
});

const signalCase = (
  set: string,
  answerable: boolean,
  distances: readonly number[],
  lexicalTop: number | null = null,
): SignalCase => ({
  set,
  answerable,
  retrieved: distances.map((distance, index) =>
    got(index * 100, index * 100 + 50, distance),
  ),
  lexicalTop,
});

describe("the signals", () => {
  it("reads closeness so that nearer is higher, like every other signal", () => {
    expect(closeness(signalCase("golden", true, [0.3, 0.5]))).toBe(-0.3);
  });

  it("reads margin as the gap from the closest passage to the k-th", () => {
    const one = signalCase("golden", true, [0.3, 0.35, 0.5]);

    expect(margin(3)(one)).toBeCloseTo(0.2);
    // Fewer than k passages is no reading, not a gap of zero.
    expect(margin(4)(one)).toBeNull();
  });
});

describe("cutSignal", () => {
  // The answerable readings out of order, 0.7 before 0.5: the cut sorts them.
  const cases = [
    signalCase("golden", true, [0.35], 0.7),
    signalCase("golden", true, [0.3], 0.5),
    signalCase("golden", false, [0.33], 0.4),
    signalCase("uncovered", false, [0.25], 0.6),
    signalCase("uncovered", false, [0.3], null),
    signalCase("golden", false, [0.5], 0.1),
  ];

  it("cuts at the lowest answerable reading when no refusal is allowed", () => {
    const [cut] = cutSignal(cases, 0.4, lexicalRank, [0]);

    expect(cut).toEqual({
      addedRefusals: 0,
      removed: {
        golden: { removed: 1, admitted: 1 },
        uncovered: { removed: 1, admitted: 2 },
      },
    });
  });

  it("moves the threshold up one answerable question per refusal allowed", () => {
    const [, cut] = cutSignal(cases, 0.4, lexicalRank, [0, 1]);

    expect(cut?.addedRefusals).toBe(1);
    expect(cut?.removed.uncovered).toEqual({ removed: 2, admitted: 2 });
  });

  it("credits the signal only with what the floor admitted", () => {
    // The question at 0.5 has the weakest reading of all, and the floor has
    // already refused it: counting it would inflate every row.
    const [cut] = cutSignal(cases, 0.4, lexicalRank, [0]);

    expect(cut?.removed.golden?.admitted).toBe(1);
  });

  it("admits a question on its closest chunk, however far the rest are", () => {
    const [cut] = cutSignal(
      [
        signalCase("golden", true, [0.3], 0.5),
        signalCase("uncovered", false, [0.3, 0.9], 0.1),
      ],
      0.4,
      lexicalRank,
      [0],
    );

    expect(cut?.removed.uncovered).toEqual({ removed: 1, admitted: 1 });
  });

  it("treats no reading as the weakest one", () => {
    const [cut] = cutSignal(
      [
        signalCase("golden", true, [0.3], 0.1),
        signalCase("uncovered", false, [0.3], null),
      ],
      0.4,
      lexicalRank,
      [0],
    );

    expect(cut?.removed.uncovered).toEqual({ removed: 1, admitted: 1 });
  });

  it("never refuses more answerable questions than allowed, even on a tie", () => {
    const [cut] = cutSignal(
      [
        signalCase("golden", true, [0.3], 0.5),
        signalCase("golden", true, [0.3], 0.5),
        signalCase("golden", false, [0.3], 0.5),
      ],
      0.4,
      lexicalRank,
      [0],
    );

    expect(cut?.addedRefusals).toBe(0);
    expect(cut?.removed.golden).toEqual({ removed: 0, admitted: 1 });
  });
});
