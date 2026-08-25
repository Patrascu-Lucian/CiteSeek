import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/lib/ai/types";

import { ChatPanel } from "./chat-panel";

const action = vi.hoisted(() => ({ deleteConversationTurn: vi.fn() }));
vi.mock("@/lib/chats/actions", () => action);

// Stateful, unlike the stub in `chat-panel.test.tsx`: this file is about a
// transcript changing, and `useState` seeded once is what the real `useChat`
// does — which is what makes the restore assertions mean anything.
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
        sendMessage: vi.fn(),
        regenerate: vi.fn(),
        stop: vi.fn(),
        clearError: vi.fn(),
      };
    },
  };
});

function question(id: string, text: string): ChatUIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

function answer(id: string, text: string): ChatUIMessage {
  return { id, role: "assistant", parts: [{ type: "text", text }] };
}

const TRANSCRIPT: ChatUIMessage[] = [
  question("m1", "How much leave?"),
  answer("m2", "Twenty-eight days."),
  question("m3", "And carry-over?"),
  answer("m4", "Five days."),
];

function panel(
  overrides: Partial<React.ComponentProps<typeof ChatPanel>> = {},
) {
  return (
    <ChatPanel
      workspaceId="w1"
      chatId="c1"
      hasReadyDocuments
      signedIn
      canDelete
      initialMessages={TRANSCRIPT}
      onOpenSource={vi.fn()}
      openChunkId={null}
      {...overrides}
    />
  );
}

async function confirmDelete(name: RegExp) {
  await userEvent.click(screen.getByRole("button", { name }));
  await userEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: /delete exchange/i,
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  action.deleteConversationTurn.mockResolvedValue({ deleted: true });
});

describe("deleting an exchange", () => {
  it("offers the control on questions and not on answers", () => {
    render(panel());

    // Named by the question, because that is what identifies the exchange —
    // and what `deleteTurn` accepts.
    expect(
      screen.getByRole("button", {
        name: /^Delete the exchange starting “How much leave/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Twenty-eight days/ }),
    ).not.toBeInTheDocument();
  });

  it("offers nothing where the transcript is not stored", () => {
    // A guest's conversation vanishes on reload, so a delete control would be
    // describing something the product never kept (ADR 040).
    render(panel({ canDelete: false }));

    expect(
      screen.queryByRole("button", {
        name: /^Delete the exchange starting “How much leave/,
      }),
    ).not.toBeInTheDocument();
  });

  it("offers nothing before a conversation exists", () => {
    render(panel({ chatId: null }));

    expect(
      screen.queryByRole("button", {
        name: /^Delete the exchange starting “How much leave/,
      }),
    ).not.toBeInTheDocument();
  });

  it("takes the answer with the question, and leaves the rest", async () => {
    render(panel());

    await confirmDelete(/^Delete the exchange starting “How much leave/);

    // The surviving answer first: `Answer` is behind `next/dynamic`, so
    // asserting the deleted one is absent before any answer has rendered would
    // pass whether or not anything was deleted.
    expect(await screen.findByText("Five days.")).toBeInTheDocument();
    expect(screen.getByText("And carry-over?")).toBeInTheDocument();

    expect(screen.queryByText("How much leave?")).not.toBeInTheDocument();
    expect(screen.queryByText("Twenty-eight days.")).not.toBeInTheDocument();

    expect(action.deleteConversationTurn).toHaveBeenCalledWith(
      "w1",
      "c1",
      "m1",
    );
  });

  it("puts the exchange back when the server says it deleted nothing", async () => {
    // The turn is hidden before the answer arrives, so a refusal the reader
    // cannot see would leave a message off screen that is still stored.
    action.deleteConversationTurn.mockResolvedValue({ deleted: false });
    render(panel());

    await confirmDelete(/^Delete the exchange starting “How much leave/);

    expect(await screen.findByText("How much leave?")).toBeInTheDocument();
    expect(screen.getByText("Twenty-eight days.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/still here/i);
  });

  it("puts the exchange back when the request fails outright", async () => {
    action.deleteConversationTurn.mockRejectedValue(new Error("offline"));
    render(panel());

    await confirmDelete(/^Delete the exchange starting “How much leave/);

    expect(await screen.findByText("How much leave?")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/nothing was deleted/i);
  });

  it("keeps the reader on the page when they change their mind", async () => {
    render(panel());

    await userEvent.click(
      screen.getByRole("button", {
        name: /^Delete the exchange starting “How much leave/,
      }),
    );
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: /keep it/i,
      }),
    );

    expect(screen.getByText("How much leave?")).toBeInTheDocument();
    expect(action.deleteConversationTurn).not.toHaveBeenCalled();
  });
});
