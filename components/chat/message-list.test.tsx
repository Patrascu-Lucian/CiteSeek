import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";

import { MessageList, messageSources, messageText } from "./message-list";

const SOURCE: ChatSource = {
  marker: 1,
  chunkId: "chunk-1",
  documentId: "doc-1",
  filename: "handbook.pdf",
  pageNumber: 3,
  charStart: 0,
  charEnd: 10,
  quote: "Expenses are reimbursed within 30 days.",
};

function userMessage(text: string): ChatUIMessage {
  return { id: "m1", role: "user", parts: [{ type: "text", text }] };
}

function assistantMessage(
  text: string,
  sources: ChatSource[] | null,
): ChatUIMessage {
  return {
    id: "m2",
    role: "assistant",
    parts: [
      ...(sources
        ? ([{ type: "data-sources", id: "sources", data: sources }] as const)
        : []),
      { type: "text", text },
    ],
  };
}

describe("messageText / messageSources", () => {
  it("joins text across parts", () => {
    const message = {
      id: "m",
      role: "assistant",
      parts: [
        { type: "text", text: "Half " },
        { type: "text", text: "and half." },
      ],
    } as ChatUIMessage;

    expect(messageText(message)).toBe("Half and half.");
  });

  it("returns no sources for a message that carries none", () => {
    // A refusal. There is nothing to cite, and nothing must be invented.
    expect(messageSources(assistantMessage("No idea.", null))).toEqual([]);
  });

  it("reads the sources part when present", () => {
    expect(messageSources(assistantMessage("Yes [1].", [SOURCE]))).toEqual([
      SOURCE,
    ]);
  });
});

describe("MessageList", () => {
  it("invites a first question when the conversation is empty", () => {
    render(
      <MessageList
        messages={[]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
      />,
    );

    expect(
      screen.getByText(/ask a question about your documents/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/answers cite the passages/i)).toBeInTheDocument();
  });

  it("announces who said what rather than relying on alignment", () => {
    // Left and right mean nothing to a screen reader.
    render(
      <MessageList
        messages={[userMessage("What is the policy?")]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
      />,
    );

    expect(screen.getByText("You asked:")).toBeInTheDocument();
  });

  it("renders an assistant answer with its citation chip", async () => {
    render(
      <MessageList
        messages={[
          userMessage("What is the policy?"),
          assistantMessage("Paid in 30 days [1].", [SOURCE]),
        ]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
      />,
    );

    // A longer wait than the 1s default, because `Answer` is now loaded through
    // `next/dynamic`. Resolving it makes Vitest transform the whole markdown
    // stack — Streamdown, its parser, highlighter and diagram renderer — on
    // first use, which takes over a second when the full suite is competing for
    // the transform pipeline. It resolves in ~500ms when this file runs alone,
    // which is exactly the kind of difference that reads as flake if the reason
    // is not written down.
    expect(
      await screen.findByRole(
        "button",
        { name: /^Citation 1/ },
        { timeout: 5_000 },
      ),
    ).toBeInTheDocument();
  });

  it("renders a user question as plain text, never as markdown", () => {
    // A question containing markdown must not be interpreted -- the user typed
    // characters, not formatting.
    render(
      <MessageList
        messages={[userMessage("What does **bold** mean here?")]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
      />,
    );

    expect(screen.getByText(/\*\*bold\*\*/)).toBeInTheDocument();
  });
});
