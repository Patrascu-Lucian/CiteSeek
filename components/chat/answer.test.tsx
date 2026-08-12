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

    // `findByText` on the marker alone now matches the note below the answer as
    // well, so this asks the question it always meant: the sentence keeps its
    // number, and nothing in the answer is pressable.
    expect(
      await screen.findByText(/A claim \[7\] with no passage behind it\./),
    ).toBeInTheDocument();
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

describe("Answer — grouped markers", () => {
  it("renders a chip per source when the model writes [1, 2]", async () => {
    const onSelectSource = vi.fn();

    render(
      <Answer
        text="Both agree [1, 2]."
        sources={[
          source({ marker: 1 }),
          source({ marker: 2, chunkId: "chunk-2", filename: "policies.pdf" }),
        ]}
        onSelectSource={onSelectSource}
        selectedChunkId={null}
      />,
    );

    expect(
      await screen.findByRole("button", { name: /^Citation 1:/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^Citation 2: policies\.pdf/ }),
    ).toBeInTheDocument();
  });

  it("leaves a group containing an invented marker as plain text", async () => {
    render(
      <Answer
        text="Both agree [1, 7]."
        sources={[source({ marker: 1 })]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
      />,
    );

    expect(await screen.findByText(/\[1, 7\]/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Answer — a marker the model invented", () => {
  it("says why the number is not a link, rather than leaving it dead", () => {
    // The guard already refuses to link it. This is the half that was missing:
    // an inert number reads as a broken button, and the person who reported it
    // that way had written the rule. ADR 036.
    renderAnswer({ text: "A claim [7] with nothing behind it." });

    expect(
      screen.getByText(/is not one of the passages found/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/treat that claim as unsupported/i)).toBeVisible();
    // The number itself, so the reader can match the note to the sentence.
    expect(screen.getByText("[7]")).toBeInTheDocument();
  });

  it("names every invented number when there are several", () => {
    renderAnswer({ text: "Claims [7] and [9]." });

    expect(screen.getByText("[7], [9]")).toBeInTheDocument();
    expect(
      screen.getByText(/are not among the passages found/i),
    ).toBeInTheDocument();
  });

  it("stays quiet when the answer cites honestly", () => {
    // The note is for a caught fabrication. On a well-cited answer it would be
    // noise in front of every reader.
    renderAnswer();

    expect(screen.queryByText(/not one of the passages/i)).toBeNull();
  });
});
