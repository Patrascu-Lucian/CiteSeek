import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { toUIMessages } from "@/lib/chats/to-ui-messages";
import { DEMO_EXAMPLE_QUESTIONS } from "@/lib/demo/example-questions";

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
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    expect(
      screen.getByText(/ask a question about your documents/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/answers cite the passages/i)).toBeInTheDocument();
  });

  it("offers starter questions on the demo, and asks the one that is clicked", async () => {
    const onAsk = vi.fn();
    render(
      <MessageList
        messages={[]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload={false}
        signedIn={false}
        isDemo
        onAsk={onAsk}
      />,
    );

    const [first] = DEMO_EXAMPLE_QUESTIONS;
    await userEvent.click(screen.getByRole("button", { name: first }));

    expect(onAsk).toHaveBeenCalledWith(first);
  });

  it("does not claim the documents are yours on the shared demo", () => {
    // They are not — it is read-only and seeded, and this is the first sentence
    // a stranger reads.
    render(
      <MessageList
        messages={[]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload={false}
        signedIn={false}
        isDemo
        onAsk={() => undefined}
      />,
    );

    expect(screen.queryByText(/your documents/i)).not.toBeInTheDocument();
  });

  it("keeps the starter questions off a workspace someone uploaded to", () => {
    // Someone who uploaded the documents knows what is in them, and a question
    // about a handbook they have never seen would be noise.
    render(
      <MessageList
        messages={[]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    expect(
      screen.queryByRole("button", { name: DEMO_EXAMPLE_QUESTIONS[0] }),
    ).not.toBeInTheDocument();
  });

  it("shows a pending answer between the question and the first token", () => {
    // ~1.03s measured, during which the reader sees only their own message.
    render(
      <MessageList
        messages={[userMessage("What is the policy?")]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
        pending
      />,
    );

    expect(document.querySelector("[data-pending]")).toBeInTheDocument();
  });

  it("drops the pending bubble once an answer exists", () => {
    render(
      <MessageList
        messages={[userMessage("What is the policy?")]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    expect(document.querySelector("[data-pending]")).not.toBeInTheDocument();
  });

  it("announces who said what rather than relying on alignment", () => {
    // Left and right mean nothing to a screen reader.
    render(
      <MessageList
        messages={[userMessage("What is the policy?")]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
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
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
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
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    expect(screen.getByText(/\*\*bold\*\*/)).toBeInTheDocument();
  });
});

describe("MessageList — a conversation restored from the database", () => {
  /**
   * The round trip conversation history made load-bearing: stored rows go
   * through `toUIMessages` and must render exactly as a streamed answer did.
   * The failure mode is quiet — the text appears, and only the chips are gone —
   * so nothing short of asserting on them catches it.
   */
  const restored = toUIMessages([
    {
      id: "stored-1",
      position: 0,
      role: "user",
      content: "When is reimbursement paid?",
      citations: [],
      refusalReason: null,
      createdAt: new Date("2026-07-30T10:00:00Z"),
    },
    {
      id: "stored-2",
      position: 1,
      role: "assistant",
      content: "Within 30 days of an approved claim [1].",
      citations: [
        {
          chunkId: "chunk-restored",
          documentId: "doc-1",
          filename: "handbook.pdf",
          pageNumber: 7,
          charStart: 0,
          charEnd: 38,
          quote: "Reimbursement is paid within 30 days.",
        },
      ],
      refusalReason: null,
      createdAt: new Date("2026-07-30T10:00:01Z"),
    },
  ]);

  it("renders a stored answer with a working citation chip", async () => {
    const onSelectSource = vi.fn();
    render(
      <MessageList
        messages={restored}
        onSelectSource={onSelectSource}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    const chip = await screen.findByRole(
      "button",
      { name: /^Citation 1/ },
      { timeout: 5_000 },
    );
    await userEvent.click(chip);

    // Clicking it hands back the passage, so the source panel can open at it —
    // which is what makes a reloaded citation as good as a live one.
    expect(onSelectSource).toHaveBeenCalledWith(
      expect.objectContaining({ chunkId: "chunk-restored", pageNumber: 7 }),
    );
  });

  it("keeps the question as text, with no chip of its own", async () => {
    render(
      <MessageList
        messages={restored}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    expect(screen.getByText(/when is reimbursement paid/i)).toBeInTheDocument();
    await screen.findByRole(
      "button",
      { name: /^Citation 1/ },
      { timeout: 5_000 },
    );
    expect(screen.getAllByRole("button", { name: /^Citation/ })).toHaveLength(
      1,
    );
  });
});

describe("MessageList — a refusal", () => {
  function refusalMessage(): ChatUIMessage {
    return {
      id: "m3",
      role: "assistant",
      parts: [
        {
          type: "data-refusal",
          id: "refusal",
          data: { reason: "no_relevant_passages" },
        },
        { type: "text", text: "I couldn't find anything relevant." },
      ],
    };
  }

  it("renders the refusal panel beside the text, not instead of it", async () => {
    render(
      <MessageList
        messages={[refusalMessage()]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    // The sentence is still the answer to the question that was asked.
    expect(
      await screen.findByText(/couldn't find anything relevant/i, undefined, {
        timeout: 5_000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("handbook.pdf")).toBeInTheDocument();
  });

  it("cites nothing, which is the failure this whole design prevents", async () => {
    // A refusal that renders a chip would be claiming a source for a claim it
    // did not make. The route never sends both parts; this asserts the client
    // could not draw one anyway.
    render(
      <MessageList
        messages={[refusalMessage()]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    await screen.findByText(/couldn't find anything relevant/i, undefined, {
      timeout: 5_000,
    });

    expect(screen.queryByRole("button", { name: /^Citation/ })).toBeNull();
  });

  it("draws no panel for an ordinary grounded answer", () => {
    render(
      <MessageList
        messages={[assistantMessage("Paid in 30 days [1].", [SOURCE])]}
        onSelectSource={vi.fn()}
        selectedChunkId={null}
        uploadHref="/w/w1"
        documents={["handbook.pdf"]}
        canUpload
        signedIn
        isDemo={false}
        onAsk={() => undefined}
      />,
    );

    expect(document.querySelector("[data-refusal]")).toBeNull();
  });
});
