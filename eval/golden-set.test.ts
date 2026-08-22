import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FOLLOW_UP_SET, GOLDEN_SET } from "./golden-set";

/** A broken quote fails as a retrieval regression rather than as a broken quote.
 * The harness needs a database and real embeddings; this needs neither, so the
 * rot is caught in CI rather than on whichever afternoon someone runs it. */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const text = (file: string) => readFileSync(join(FIXTURES, file), "utf8");

describe.each([
  { name: "golden", expectations: GOLDEN_SET.flatMap((one) => one.expect) },
  {
    name: "follow-up",
    expectations: FOLLOW_UP_SET.flatMap((one) => one.expect),
  },
])("the $name set", ({ expectations }) => {
  it("quotes every passage verbatim", () => {
    for (const { file, quote } of expectations) {
      // Line breaks survive normalization, so a quote spanning one never
      // resolves — which is how the first run of the harness failed.
      expect(quote, `"${quote}" is not in ${file}`).not.toMatch(/\n/);
      expect(text(file), `"${quote}" is not in ${file}`).toContain(quote);
    }
  });

  it("quotes each passage unambiguously", () => {
    // `indexOf` takes the first hit, so a quote appearing twice would silently
    // measure retrieval against whichever copy came first in the file.
    for (const { file, quote } of expectations) {
      const source = text(file);
      const first = source.indexOf(quote);

      expect(
        source.indexOf(quote, first + 1),
        `"${quote}" appears more than once in ${file}`,
      ).toBe(-1);
    }
  });
});

describe("the two sets together", () => {
  it("has no quote that another quote contains", () => {
    // Reword a fixture and the longer quote fails loudly, while the shorter one
    // keeps matching a passage that no longer means what it was chosen for.
    const quotes = [...GOLDEN_SET, ...FOLLOW_UP_SET].flatMap((one) =>
      one.expect.map((e) => e.quote),
    );

    for (const quote of quotes) {
      expect(
        quotes.filter((other) => other !== quote && other.includes(quote)),
        `"${quote}" is contained by another quote`,
      ).toEqual([]);
    }
  });
});

describe("the golden set", () => {
  it("keeps enough unanswerable questions to measure the floor", () => {
    // A set of only answerable questions cannot see the floor fail open, which
    // is the failure that puts an ungrounded answer in front of a reader.
    const unanswerable = GOLDEN_SET.filter((one) => one.expect.length === 0);

    expect(unanswerable.length).toBeGreaterThanOrEqual(10);
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(40);
  });
});

describe("the follow-up set", () => {
  /* Both halves have to be answerable, or the comparison measures nothing: the
     standalone column is the ceiling, and a case the corpus cannot answer either
     way would report a gap of zero and look like success. */
  it("expects a passage for every case", () => {
    for (const one of FOLLOW_UP_SET) {
      expect(one.expect.length, one.followUp).toBeGreaterThan(0);
    }
  });

  it("carries the turns a rewriting step would read", () => {
    for (const one of FOLLOW_UP_SET) {
      expect(one.context.length, one.followUp).toBeGreaterThan(0);
    }
  });

  it("keeps the follow-up shorter than the standalone it stands for", () => {
    // The point of the case is that the typed form carries less. One as long as
    // its standalone is not a follow-up, and would flatter the "as asked" score.
    for (const one of FOLLOW_UP_SET) {
      expect(one.followUp.length, one.followUp).toBeLessThan(
        one.standalone.length,
      );
    }
  });
});
