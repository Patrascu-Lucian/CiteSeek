import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/lib/ai/types";

import { ChatPanel } from "./chat-panel";

const action = vi.hoisted(() => ({
  clearFromTurn: vi.fn(),
  deleteConversationTurn: vi.fn(),
}));
vi.mock("@/lib/chats/actions", () => action);

const sent = vi.hoisted(() => ({ sendMessage: vi.fn() }));

vi.mock("@ai-sdk/react", async () => {
  const { useState } = await import("react");

  return {
    useChat: (options: { messages?: ChatUIMessage[] }) => {
      const [messages, setMessages] = useState(options.messages ?? []);

      return {
        messages,
        setMessages,
        status: "ready",
        error: undefined,
        sendMessage: sent.sendMessage,
        regenerate: vi.fn(),
        stop: vi.fn(),
        clearError: vi.fn(),
      };
    },
  };
});

const TRANSCRIPT: ChatUIMessage[] = [
  {
    id: "m1",
    role: "user",
    parts: [{ type: "text", text: "How much leave?" }],
  },
  {
    id: "m2",
    role: "assistant",
    parts: [{ type: "text", text: "Twenty-eight days." }],
  },
  {
    id: "m3",
    role: "user",
    parts: [{ type: "text", text: "And carry-over?" }],
  },
  {
    id: "m4",
    role: "assistant",
    parts: [{ type: "text", text: "Five days." }],
  },
];

function panel(props: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  return render(
    <ChatPanel
      workspaceId="w1"
      chatId="c1"
      hasReadyDocuments
      signedIn
      canDelete
      initialMessages={TRANSCRIPT}
      onOpenSource={vi.fn()}
      openChunkId={null}
      {...props}
    />,
  );
}

async function openEditor() {
  await userEvent.click(
    screen.getByRole("button", { name: /^Edit the question “How much leave/ }),
  );
  return screen.getByRole("textbox", { name: /edit your question/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  action.clearFromTurn.mockResolvedValue({ cleared: true });
});

describe("editing a question", () => {
  it("replaces the question in place, seeded with what was asked", async () => {
    panel();

    expect(await openEditor()).toHaveValue("How much leave?");
  });

  it("clears from that turn and asks the reworded question", async () => {
    panel();

    const field = await openEditor();
    await userEvent.clear(field);
    await userEvent.type(field, "How much leave do I get?");
    await userEvent.click(screen.getByRole("button", { name: /ask again/i }));

    expect(action.clearFromTurn).toHaveBeenCalledWith("w1", "c1", "m1");
    expect(sent.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        parts: [{ type: "text", text: "How much leave do I get?" }],
      }),
    );
  });

  /* Everything below the question goes: its answer was grounded in the old
     wording, and the turns after followed from that answer. */
  it("takes the later turns with it, not just the one edited", async () => {
    panel();

    const field = await openEditor();
    await userEvent.type(field, " exactly");
    await userEvent.click(screen.getByRole("button", { name: /ask again/i }));

    expect(screen.queryByText("And carry-over?")).not.toBeInTheDocument();
    expect(screen.queryByText("How much leave?")).not.toBeInTheDocument();
  });

  it("puts the transcript back when the server clears nothing", async () => {
    action.clearFromTurn.mockResolvedValue({ cleared: false });
    panel();

    const field = await openEditor();
    await userEvent.type(field, " exactly");
    await userEvent.click(screen.getByRole("button", { name: /ask again/i }));

    expect(await screen.findByText("How much leave?")).toBeInTheDocument();
    expect(screen.getByText("And carry-over?")).toBeInTheDocument();
    expect(sent.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/unchanged/i);
  });

  it("leaves everything alone when the reader backs out", async () => {
    panel();

    await openEditor();
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.getByText("How much leave?")).toBeInTheDocument();
    expect(action.clearFromTurn).not.toHaveBeenCalled();
    expect(sent.sendMessage).not.toHaveBeenCalled();
  });

  it("offers no editing where the transcript is not stored", () => {
    panel({ canDelete: false });

    expect(
      screen.queryByRole("button", { name: /^Edit the question/ }),
    ).not.toBeInTheDocument();
  });
});
