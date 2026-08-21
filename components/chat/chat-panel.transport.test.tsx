import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatPanel } from "./chat-panel";

/** A Server Action module: importing it for real pulls the database into a jsdom
 * test. Its behavior is covered in `actions.integration.test.ts`. */
vi.mock("@/lib/chats/actions", () => ({ deleteConversationTurn: vi.fn() }));

/** The real `useChat` and transport against a stubbed `fetch`. Every other test
 * replaces `useChat`, which is how the route went months without being told
 * which conversation was open — covered on both sides, never at the seam. */

function captureRequest() {
  const sent: { body?: unknown } = {};

  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) => {
      sent.body = JSON.parse(
        typeof init.body === "string" ? init.body : "null",
      );
      // Failing the request is enough: what is asserted is what left the client.
      return Promise.resolve(new Response("", { status: 500 }));
    }),
  );

  return sent;
}

afterEach(() => vi.unstubAllGlobals());

async function ask(chatId: string | null) {
  const sent = captureRequest();

  render(
    <ChatPanel
      workspaceId="workspace-1"
      chatId={chatId}
      hasReadyDocuments
      onOpenSource={() => {}}
      openChunkId={null}
    />,
  );

  await userEvent.type(
    screen.getByRole("textbox", { name: /ask a question/i }),
    "What is the policy?",
  );
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  await waitFor(() => expect(sent.body).toBeDefined());

  return sent.body as { chatId?: string | null; messages?: unknown[] };
}

describe("which conversation a turn is sent to", () => {
  it("names the open conversation", async () => {
    expect(await ask("chat-42")).toMatchObject({ chatId: "chat-42" });
  });

  // Null is the one case where the route creating a conversation is correct.
  it("sends null before one exists", async () => {
    expect(await ask(null)).toMatchObject({ chatId: null });
  });

  // `prepareSendMessagesRequest` replaces the body rather than extending it, so
  // adding a field can silently drop the transcript.
  it("still sends the transcript", async () => {
    const body = await ask("chat-42");

    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages).toHaveLength(1);
  });
});
