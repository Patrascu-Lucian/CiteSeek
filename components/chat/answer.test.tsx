import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ChatSource } from "@/lib/ai/types";

import { Answer } from "./answer";

function source(overrides: Partial<ChatSource> = {}): ChatSource {
  return {
    marker: 1,
    chunkId: "chunk-1",
    documentId: "doc-1",
    filename: "handbook.pdf",
    pageNumber: 3,
    charStart: 0,
    charEnd: 10,
    quote: "Expenses are reimbursed within 30 days.",
    ...overrides,
  };
}

function renderAnswer(props: Partial<Parameters<typeof Answer>[0]> = {}) {
  const onSelectSource = vi.fn();

  render(
    <Answer
      text="Expenses are paid in 30 days [1]."
      sources={[source()]}
      onSelectSource={onSelectSource}
      selectedChunkId={null}
      {...props}
    />,
  );

  return { onSelectSource };
}

describe("Answer — citation markers", () => {
  it("renders a marker as a button naming its document", async () => {
    renderAnswer();

    // The accessible name, not the visible "1": a screen reader user needs to
    // know what opening it will show.
    expect(
      await screen.findByRole("button", {
        name: "Citation 1: handbook.pdf, page 3",
      }),
    ).toBeInTheDocument();
  });

  it("hands the whole source back when a chip is activated", async () => {
    const { onSelectSource } = renderAnswer();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }),
    );

    // The chip passes the server's record, not a number the client re-resolved.
    expect(onSelectSource).toHaveBeenCalledWith(
      expect.objectContaining({ chunkId: "chunk-1", marker: 1 }),
    );
  });

  it("renders an invented marker as plain text, not a chip", async () => {
    // Only one passage was retrieved, and the model wrote [7]. There is nothing
    // to open, so nothing may look openable.
    renderAnswer({ text: "A claim [7] with no passage behind it." });

    expect(await screen.findByText(/\[7\]/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks the open citation as pressed", async () => {
    renderAnswer({ selectedChunkId: "chunk-1" });

    expect(
      await screen.findByRole("button", { name: /^Citation 1/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("is reachable by keyboard", async () => {
    const { onSelectSource } = renderAnswer();
    await screen.findByRole("button", { name: /^Citation 1/ });

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(onSelectSource).toHaveBeenCalled();
  });

  it("renders a refusal with no chips at all", async () => {
    renderAnswer({
      text: "I couldn't find anything relevant to that in your documents.",
      sources: [],
    });

    expect(
      await screen.findByText(/couldn't find anything relevant/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
