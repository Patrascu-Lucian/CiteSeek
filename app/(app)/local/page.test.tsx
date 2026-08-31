import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LocalPage from "./page";

vi.mock("@/components/local/local-workspace", () => ({
  // The page's own claims are the subject; the workspace reaches for IndexedDB
  // and WebGPU, neither of which exists here.
  LocalWorkspace: () => null,
}));

/**
 * This page tells a reader how much to trust an answer, and the numbers in it
 * came from a run that can be repeated. A re-run that moves them and leaves the
 * copy alone turns a measurement into a claim.
 */
describe("the local mode page", () => {
  const report = readFileSync(
    join(import.meta.dirname, "..", "..", "..", "eval", "local-markers.md"),
    "utf8",
  );

  it("quotes the grounding figure the committed run measured", () => {
    const grounded = /Grounded (\d+)\/(\d+)/.exec(report);

    expect(grounded, "eval/local-markers.md has no grounded total").not.toBe(
      null,
    );

    render(<LocalPage />);

    expect(
      screen.getByText(
        new RegExp(
          `${grounded![2]!} questions.+right figure ${grounded![1]!} times`,
          "s",
        ),
      ),
    ).toBeInTheDocument();
  });

  it("does not tell the reader to check the citations", () => {
    // It did, and the run measures zero — advice the page cannot honour is
    // worse than no advice.
    const cited = /cited (\d+)\/(\d+)/.exec(report);

    expect(cited?.[1], "eval/local-markers.md has no cited total").toBe("0");

    render(<LocalPage />);

    expect(screen.queryByText(/check the citations/i)).not.toBeInTheDocument();
    expect(screen.getByText(/does not cite/i)).toBeInTheDocument();
  });

  it("keeps the experimental label", () => {
    render(<LocalPage />);

    expect(screen.getByText(/experimental/i)).toBeInTheDocument();
  });
});
