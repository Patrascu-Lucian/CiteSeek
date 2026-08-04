import { describe, expect, it } from "vitest";

import {
  mean,
  overlaps,
  scoreQuery,
  sweepFloor,
  type Retrieved,
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
    const score = scoreQuery([span(100, 200)], [got(150, 400)], 5);

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
});

describe("mean", () => {
  it("is 0 for nothing, rather than NaN", () => {
    // A NaN here would propagate silently into a reported table.
    expect(mean([])).toBe(0);
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
