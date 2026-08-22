import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/lib/ai/types";

import { ChatPanel } from "./chat-panel";

/** A Server Action module: importing it for real pulls the database into a jsdom
 * test. Its behavior is covered in `actions.integration.test.ts`. */
vi.mock("@/lib/chats/actions", () => ({ deleteConversationTurn: vi.fn() }));

/** A performance regression asserted as behavior: the draft used to live in
 * `ChatPanel`, so one keystroke re-parsed every `Answer`. Renders rather than
 * milliseconds, because the count is what regressed. */
const transcript = vi.hoisted(() => ({ renders: 0 }));

vi.mock("./message-list", () => ({
  MessageList: () => {
    transcript.renders += 1;
    return <div data-testid="transcript" />;
  },
  // `ChatPanel` warms the markdown chunk at idle through this. Stubbed rather
  // than left out: an unmocked named export throws at import time.
  warmAnswer: vi.fn(),
}));

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

beforeEach(() => {
  transcript.renders = 0;
  vi.clearAllMocks();
});

describe("ChatPanel — typing", () => {
  it("does not re-render the transcript on every keystroke", async () => {
    render(
      <ChatPanel
        workspaceId="w1"
        hasReadyDocuments
        onOpenSource={() => undefined}
        openChunkId={null}
      />,
    );

    const after = transcript.renders;
    expect(after).toBeGreaterThan(0);

    await userEvent.type(
      screen.getByRole("textbox", { name: /ask a question/i }),
      "What is the policy?",
    );

    // Nineteen characters, and the transcript is not a function of any of them.
    expect(transcript.renders).toBe(after);
  });

  it("still re-renders it when a question is actually sent", async () => {
    // The guard against fixing the above by severing the wiring: the draft is
    // local, but submitting still has to reach the panel.
    render(
      <ChatPanel
        workspaceId="w1"
        hasReadyDocuments
        onOpenSource={() => undefined}
        openChunkId={null}
      />,
    );

    await userEvent.type(
      screen.getByRole("textbox", { name: /ask a question/i }),
      "What is the policy?{Enter}",
    );

    expect(chat.sendMessage).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parts: [{ type: "text", text: "What is the policy?" }],
      }),
    );
  });
});
