import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
  `eval/local-markers.md` says why this exists: a number copied into two
  generated files goes stale. The README is the third copy, and the `/local`
  page is already pinned to the same run by `app/(app)/local/page.test.tsx`.
*/
const read = (...parts: string[]) =>
  readFileSync(join(import.meta.dirname, ...parts), "utf8");

describe("the README's local-mode numbers", () => {
  const report = read("eval", "local-markers.md");
  const readme = read("README.md");

  const measured = /Grounded (\d+)\/(\d+), cited (\d+)\/\d+/.exec(report);

  /** Blockquote markers and line wraps out, so a claim can be matched as the
   * sentence it is rather than as the shape the wrapping happens to give it. */
  const prose = readme.replace(/\n>? */g, " ");

  it("has a run to check against", () => {
    expect(
      measured,
      "eval/local-markers.md has no grounded/cited line",
    ).not.toBe(null);
  });

  it("quotes the grounding figure that run measured", () => {
    const [, grounded, total] = measured!;

    // Unwrapped first, then two plain contains: a regex bounding the distance
    // between the numbers fails on prose that is perfectly correct, which is
    // worse than the drift it guards.
    expect(prose).toContain(`${total!} questions`);
    expect(prose).toContain(`right figure ${grounded!} times`);
  });

  it("does not claim a citation the run did not find", () => {
    // 0/24 is the whole reason local mode ships behind a label; a README that
    // drifted upward here would oversell the thing the page warns about.
    expect(measured![3]).toBe("0");
    expect(prose).toContain("cited a passage in none of them");
  });

  it("checks the other file the prose cites, not only the one it quotes", () => {
    /*
      Two runs, two dates: `local-markers.md` is the browser, `local-answers.md`
      the CPU harness. They agree today, so pinning one leaves the sentence that
      names the other free to drift — which is the failure this file exists for,
      one paragraph further down the page.
    */
    const answers = read("eval", "local-answers.md");
    const shipped = /^\| 3 \|[^|]*\|[^|]*\| (\d+)\/(\d+) \|/m.exec(answers);

    expect(shipped, "eval/local-answers.md has no three-passage row").not.toBe(
      null,
    );
    expect(shipped![1]).toBe("0");

    expect(prose).toContain(
      `not sometimes, but in all ${shipped![2]!} questions`,
    );
  });
});
