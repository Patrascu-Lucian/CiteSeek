import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("keeps the word when ready, even though a phone shows a glyph", () => {
    // Guards the `sr-only` half: a change meant to save space must not take the
    // word out of the accessibility tree.
    render(<StatusBadge status="ready" />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("carries progress while processing", () => {
    // Never a glyph: without the count, stuck and moving look identical.
    render(<StatusBadge status="processing" embedded={3} total={10} />);

    expect(screen.getByText("Processing 3/10")).toBeInTheDocument();
  });

  it("falls back to the bare word when there is nothing to count yet", () => {
    render(<StatusBadge status="processing" />);

    expect(screen.getByText("Processing")).toBeInTheDocument();
  });

  it("names the other states in text", () => {
    const { rerender } = render(<StatusBadge status="queued" />);
    expect(screen.getByText("Queued")).toBeInTheDocument();

    rerender(<StatusBadge status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
