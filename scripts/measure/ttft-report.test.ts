import { describe, expect, it } from "vitest";

import { ttftFigures, ttftReport } from "./ttft-report.mts";

const samples = [
  { firstByte: 401.9, firstToken: 912.2 },
  "The chat route answered 429.",
  { firstByte: 391.5, firstToken: 1004.9 },
];

const run = {
  day: "2026-11-13",
  base: "https://citeseek.app",
  question: "What is the expenses policy?",
  warmedUp: true,
  pauseMs: 16_000,
  samples,
};

describe("ttftFigures", () => {
  it("takes the midpoint of an even count of completed samples, as the page quotes it", () => {
    expect(ttftFigures(samples)).toEqual({
      completed: 2,
      firstByte: "397 ms",
      firstToken: "0.96 s",
    });
  });

  it("has nothing to give when no sample completed", () => {
    expect(ttftFigures(["The chat route answered 429."])).toBeNull();
  });
});

describe("ttftReport", () => {
  it("bolds the two figures exactly as the page quotes them", () => {
    const report = ttftReport(run);

    expect(report).toContain("**397 ms** to the first byte");
    expect(report).toContain("**0.96 s** to the first token");
  });

  it("names what was measured, and how", () => {
    const report = ttftReport(run);

    expect(report).toContain("against https://citeseek.app.\n");
    expect(report).toContain('in the demo: "What is the expenses policy?"\n');
    expect(report).toContain("A warm-up request was discarded first.\n");
    expect(report).toContain(
      "2 of 3 samples completed, with a 16 s pause between requests.\n",
    );
  });

  it("lists every sample in order, a failed one with its reason", () => {
    expect(ttftReport(run)).toContain(
      [
        "- 1: first byte 402 ms, first token 912 ms",
        "- 2: The chat route answered 429.",
        "- 3: first byte 392 ms, first token 1005 ms",
      ].join("\n"),
    );
  });

  it("says so when nothing was discarded and nothing paced the run", () => {
    const report = ttftReport({ ...run, warmedUp: false, pauseMs: 0 });

    expect(report).toContain("No warm-up request was discarded.\n");
    expect(report).toContain("2 of 3 samples completed.\n");
  });

  it("refuses to publish a run in which no sample completed", () => {
    expect(() =>
      ttftReport({ ...run, samples: ["The stream closed."] }),
    ).toThrow("No sample completed.");
  });
});
