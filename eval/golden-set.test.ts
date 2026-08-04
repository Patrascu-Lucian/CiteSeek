import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GOLDEN_SET } from "./golden-set";

/**
 * The golden set is only as good as its quotes, and a broken one fails as a
 * retrieval regression rather than as a broken quote. The harness needs a
 * database and real embeddings; this needs neither, so the rot is caught in CI
 * on every push instead of on whichever afternoon someone runs the evaluation.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

const text = (file: string) => readFileSync(join(FIXTURES, file), "utf8");

describe("the golden set", () => {
  it.each([
    ...new Set(GOLDEN_SET.flatMap((one) => one.expect.map((e) => e.file))),
  ])("quotes %s verbatim", (file) => {
    const source = text(file);

    for (const { quote } of GOLDEN_SET.flatMap((one) =>
      one.expect.filter((e) => e.file === file),
    )) {
      // Line breaks survive normalization, so a quote spanning one never
      // resolves — which is how the first run of the harness failed.
      expect(quote, `"${quote}" is not in ${file}`).not.toMatch(/\n/);
      expect(source, `"${quote}" is not in ${file}`).toContain(quote);
    }
  });

  it("quotes each passage unambiguously", () => {
    // `indexOf` takes the first hit, so a quote appearing twice would silently
    // measure retrieval against whichever copy came first in the file.
    for (const { file, quote } of GOLDEN_SET.flatMap((one) => one.expect)) {
      const source = text(file);
      const first = source.indexOf(quote);

      expect(
        source.indexOf(quote, first + 1),
        `"${quote}" appears more than once in ${file}`,
      ).toBe(-1);
    }
  });

  it("keeps enough unanswerable questions to measure the floor", () => {
    // A set of only answerable questions cannot see the floor fail open, which
    // is the failure that puts an ungrounded answer in front of a reader.
    const unanswerable = GOLDEN_SET.filter((one) => one.expect.length === 0);

    expect(unanswerable.length).toBeGreaterThanOrEqual(10);
    expect(GOLDEN_SET.length).toBeGreaterThanOrEqual(40);
  });
});
