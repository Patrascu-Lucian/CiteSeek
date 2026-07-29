import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";

import { ChatPanel } from "./chat-panel";

/**
 * `useChat` owns a network connection, so it is replaced here. Everything else —
 * the states, the wiring, the accessible names — is the component's own and runs
 * for real. The route's behavior is covered by its integration tests instead.
 */
const chat = vi.hoisted(() => ({
  messages: [] as ChatUIMessage[],
  status: "ready",
  error: undefined as Error | undefined,
  sendMessage: vi.fn(),
  regenerate: vi.fn(),
  stop: vi.fn(),
  clearError: vi.fn(),
}));

vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));

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

const ANSWER: ChatUIMessage = {
  id: "m2",
  role: "assistant",
  parts: [
    { type: "data-sources", id: "sources", data: [SOURCE] },
    { type: "text", text: "Paid in 30 days [1]." },
  ],
};

beforeEach(() => {
  chat.messages = [];
  chat.status = "ready";
  chat.error = undefined;
  vi.clearAllMocks();
});

function renderPanel(hasReadyDocuments = true) {
  render(<ChatPanel workspaceId="w1" hasReadyDocuments={hasReadyDocuments} />);
}

describe("ChatPanel — states", () => {
  it("explains there is nothing to search before any document is ready", () => {
    // Every question here would retrieve nothing and get the same refusal,
    // which reads like a broken feature rather than an empty one.
    renderPanel(false);

    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("invites a first question once a document is ready", () => {
    renderPanel();

    expect(
      screen.getByRole("textbox", { name: /ask a question/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/answers cite the passages/i)).toBeInTheDocument();
  });

  it("announces progress without reading the answer aloud on every token", () => {
    // A live region wrapped around streaming text re-reads the whole answer as
    // each token lands. This announces state instead.
    chat.status = "streaming";
    renderPanel();

    const status = screen.getByText(/writing an answer/i);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("offers a retry when the answer fails", async () => {
    chat.error = new Error("stream broke");
    renderPanel();

    expect(screen.getByRole("alert")).toHaveTextContent(/didn't come through/i);
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    // Cleared first, so a second failure re-renders the alert rather than
    // leaving a stale one on screen.
    expect(chat.clearError).toHaveBeenCalledOnce();
    expect(chat.regenerate).toHaveBeenCalledOnce();
  });
});

describe("ChatPanel — asking", () => {
  it("sends the question and clears the composer", async () => {
    renderPanel();

    await userEvent.type(screen.getByRole("textbox"), "What is the policy?");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(chat.sendMessage).toHaveBeenCalledWith({
      text: "What is the policy?",
    });
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("stops a reply that is still streaming", async () => {
    chat.status = "streaming";
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: /stop/i }));

    expect(chat.stop).toHaveBeenCalledOnce();
  });
});

describe("ChatPanel — citations", () => {
  it("opens the cited passage when a chip is activated", async () => {
    chat.messages = [ANSWER];
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }),
    );

    expect(screen.getByText(SOURCE.quote)).toBeInTheDocument();
    expect(screen.getByText(/handbook\.pdf.*page 3/)).toBeInTheDocument();
  });

  it("marks the chip as pressed while its passage is open", async () => {
    chat.messages = [ANSWER];
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }),
    );

    // Re-queried rather than reusing the reference: the markdown renderer
    // rebuilds its output on re-render, so the original node is detached.
    expect(
      await screen.findByRole("button", { name: /^Citation 1/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("closes the passage again", async () => {
    chat.messages = [ANSWER];
    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /^Citation 1/ }),
    );
    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(screen.queryByText(SOURCE.quote)).not.toBeInTheDocument();
  });
});
