import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/lib/ai/types";

import { ChatPanel } from "./chat-panel";

/**
 * A performance regression, asserted as behavior.
 *
 * The draft question used to live in `ChatPanel`, so every keystroke re-rendered
 * the panel and everything under it — including `MessageList`, which re-renders
 * each `Answer`, each of which re-parses its markdown through Streamdown. On a
 * conversation with a few answers in it, typing one character rebuilt the whole
 * transcript, and it looked like the page was reloading as you typed.
 *
 * Kept in its own file because the counting stub below replaces `MessageList`
 * for the entire module, which the citation tests next door need to be real.
 *
 * This measures renders rather than milliseconds on purpose: a timing assertion
 * would be flaky on a loaded machine, and the render count is the thing that
 * actually regressed.
 */
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
    render(<ChatPanel workspaceId="w1" hasReadyDocuments />);

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
    render(<ChatPanel workspaceId="w1" hasReadyDocuments />);

    await userEvent.type(
      screen.getByRole("textbox", { name: /ask a question/i }),
      "What is the policy?{Enter}",
    );

    expect(chat.sendMessage).toHaveBeenCalledExactlyOnceWith({
      text: "What is the policy?",
    });
  });
});
