import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ChatSource } from "@/lib/ai/types";

import { CopyAnswer } from "./copy-answer";

const source = (marker: number, filename: string): ChatSource => ({
  marker,
  filename,
  pageNumber: null,
  chunkId: `chunk-${String(marker)}`,
  documentId: "doc",
  charStart: 0,
  charEnd: 10,
  quote: "…",
});

describe("CopyAnswer", () => {
  it("copies the answer with a list of what each marker was", async () => {
    const user = userEvent.setup();
    render(
      <CopyAnswer
        text="The deposit is £1,200 [1]."
        sources={[source(1, "tenancy.pdf"), source(2, "unused.md")]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /copy the answer/i }));

    expect(await navigator.clipboard.readText()).toBe(
      "The deposit is £1,200 [1].\n\nSources:\n[1] tenancy.pdf",
    );
  });

  it("says so afterwards, in the name the control carries", async () => {
    // The confirmation is the button's own label rather than a live region:
    // every answer has one of these, and a region on each would announce the
    // whole transcript's worth.
    const user = userEvent.setup();
    render(<CopyAnswer text="An answer [1]." sources={[source(1, "a.md")]} />);

    await user.click(screen.getByRole("button", { name: /copy the answer/i }));

    expect(
      await screen.findByRole("button", { name: /answer copied/i }),
    ).toBeInTheDocument();
  });

  it("claims nothing when the clipboard refuses", async () => {
    // An insecure origin or a denied permission. A confirmation the clipboard
    // did not earn is worse than no confirmation.
    const user = userEvent.setup();
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("denied")),
    });

    render(<CopyAnswer text="An answer [1]." sources={[source(1, "a.md")]} />);
    await user.click(screen.getByRole("button", { name: /copy the answer/i }));

    expect(
      screen.getByRole("button", { name: /copy the answer/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /answer copied/i }),
    ).not.toBeInTheDocument();
  });
});
