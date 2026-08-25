import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/lib/ai/types";
import type { DocumentSummary } from "@/lib/documents/queries";

import { ChatSection } from "./chat-section";
import { WorkspaceShell } from "./workspace-shell";

/** `refresh` is observed rather than merely stubbed: it is what re-renders the
 * server data behind the conversation list. */
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
const nav = vi.hoisted(() => ({ pathname: "/w/w1", search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

/** The action reaches Auth.js through `authorizeWorkspace`, which has no server
 * to run in here. Its own behaviour is covered in `actions.integration.test.ts`. */
vi.mock("@/lib/chats/actions", () => ({ createConversation: vi.fn() }));

/** The stub keeps `onFinish` so a test can end a turn — the event this reacts to. */
const chat = vi.hoisted(() => ({
  onFinish: undefined as (() => void) | undefined,
}));

vi.mock("@ai-sdk/react", async () => {
  const { useState } = await import("react");

  return {
    useChat: (options: {
      onFinish?: () => void;
      messages?: readonly unknown[];
    }) => {
      chat.onFinish = options.onFinish;

      // `useState`, not the prop returned directly: the real `useChat` seeds
      // once per mount, and a mock that echoed the prop would pass the tests
      // below whether or not the transcript follows the conversation.
      const [messages] = useState(options.messages ?? []);

      return {
        messages,
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

function doc(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "doc-1",
    filename: "handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    status: "processing",
    error: null,
    pageCount: null,
    chunkCount: null,
    embeddedChunkCount: 0,
    createdAt: new Date("2026-07-29T10:00:00Z"),
    updatedAt: new Date("2026-07-29T10:00:00Z"),
    ...overrides,
  };
}

/** The next poll returns these documents. */
function pollReturns(documents: DocumentSummary[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ documents }),
      } as Response),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  chat.onFinish = undefined;
  nav.pathname = "/w/w1";
  nav.search = "";
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Together, the way the layout composes them: rendering either alone would test
 * a seam the app does not have. */
function workspace({
  documents = [doc()],
  signedIn = true,
  canWrite = true,
  isDemo = false,
  activeChatId = null,
  initialMessages = [],
  chats = [],
}: {
  documents?: DocumentSummary[];
  signedIn?: boolean;
  canWrite?: boolean;
  isDemo?: boolean;
  activeChatId?: string | null;
  initialMessages?: ChatUIMessage[];
  chats?: React.ComponentProps<typeof WorkspaceShell>["chats"];
} = {}) {
  return (
    <WorkspaceShell
      workspaceId="w1"
      initialDocuments={documents}
      chats={chats}
      canWrite={canWrite}
      signedIn={signedIn}
      conversationCap={null}
    >
      <ChatSection
        workspaceId="w1"
        activeChatId={activeChatId}
        initialMessages={initialMessages}
        signedIn={signedIn}
        isDemo={isDemo}
        canWrite={canWrite}
        messageCap={null}
      />
    </WorkspaceShell>
  );
}

function renderWorkspace(options: Parameters<typeof workspace>[0] = {}) {
  return render(workspace(options));
}

const READY = {
  status: "ready",
  chunkCount: 3,
  embeddedChunkCount: 3,
} as const;

describe("the conversation list after a turn", () => {
  it("refetches the server data once an answer has finished", () => {
    // The regression: titles and counts are server-rendered, and nothing told
    // them a turn had happened.
    renderWorkspace({ documents: [doc(READY)] });

    expect(router.refresh).not.toHaveBeenCalled();

    chat.onFinish?.();

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("does not refetch for a guest, who has no stored conversation", () => {
    // Guest turns are never written down, so a refetch would re-render the same
    // markup and spend a request saying nothing changed.
    renderWorkspace({ documents: [doc(READY)], signedIn: false });

    chat.onFinish?.();

    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("chat follows the document list", () => {
  it("opens the composer when a processing document becomes ready", async () => {
    // The regression, and why `hasReadyDocuments` crosses a context rather than
    // being server-rendered: computed there, chat kept the value it was born
    // with and stayed on "Nothing to search yet" until a reload.
    pollReturns([
      doc({ status: "ready", chunkCount: 3, embeddedChunkCount: 3 }),
    ]);
    renderWorkspace({ documents: [doc({ status: "processing" })] });

    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    // One poll interval.
    await vi.advanceTimersByTimeAsync(2_000);

    await waitFor(() => {
      expect(
        screen.getByRole("textbox", { name: /ask a question/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/nothing to search yet/i),
    ).not.toBeInTheDocument();
  });

  it("says there is nothing to search while a document is still processing", () => {
    renderWorkspace({ documents: [doc({ status: "processing" })] });

    // Every question here would retrieve nothing and get the same refusal,
    // which reads like a broken feature rather than an unfinished upload.
    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
  });

  it("offers the composer immediately when a document is already ready", () => {
    renderWorkspace({ documents: [doc({ status: "ready", chunkCount: 3 })] });

    expect(
      screen.getByRole("textbox", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("renders both sections under their own headings", () => {
    renderWorkspace({ documents: [doc({ status: "ready" })] });

    expect(
      screen.getByRole("heading", { level: 2, name: /documents/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /ask/i }),
    ).toBeInTheDocument();
  });

  it("hides the upload control from a read-only visitor and explains why", () => {
    renderWorkspace({
      documents: [doc({ status: "ready" })],
      canWrite: false,
      signedIn: false,
    });

    expect(
      screen.queryByRole("button", { name: /drop files here/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/this workspace is read-only/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /sign in to upload/i }),
    ).toBeInTheDocument();
  });

  /* Signed in *and* unable to write — the demo's combination, and the one no
     test covered. ADR 040. */
  it("offers no conversations on a workspace the signed-in reader cannot write", () => {
    renderWorkspace({
      documents: [doc({ status: "ready" })],
      canWrite: false,
      isDemo: true,
    });

    expect(
      screen.queryByRole("heading", { level: 2, name: /conversations/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /new conversation/i }),
    ).not.toBeInTheDocument();
  });

  it("still offers conversations on a workspace the reader can write", () => {
    renderWorkspace({ documents: [doc({ status: "ready" })] });

    expect(
      screen.getByRole("button", { name: /new conversation/i }),
    ).toBeInTheDocument();
  });
});

describe("when the open conversation goes away", () => {
  const answered: ChatUIMessage[] = [
    { id: "m1", role: "user", parts: [{ type: "text", text: "A question" }] },
  ];

  it("clears the transcript when the last conversation is deleted", () => {
    // The regression: `useChat` seeds once, so handing it an empty list left
    // the deleted conversation's messages on screen.
    const { rerender } = renderWorkspace({
      documents: [doc(READY)],
      activeChatId: "chat-1",
      initialMessages: answered,
    });
    expect(screen.getByText("A question")).toBeInTheDocument();

    rerender(workspace({ documents: [doc(READY)] }));

    expect(screen.queryByText("A question")).not.toBeInTheDocument();
    // The empty state's own line: "Ask a question…" also labels the composer.
    expect(screen.getByText(/answers cite the passages/i)).toBeInTheDocument();
  });

  it("shows the newly opened conversation when switching between them", () => {
    // The same defect from the other side, and the worse one: another
    // conversation's transcript.
    const { rerender } = renderWorkspace({
      documents: [doc(READY)],
      activeChatId: "chat-1",
      initialMessages: answered,
    });

    rerender(
      workspace({
        documents: [doc(READY)],
        activeChatId: "chat-2",
        initialMessages: [
          {
            id: "m2",
            role: "user",
            parts: [{ type: "text", text: "Another question" }],
          },
        ],
      }),
    );

    expect(screen.queryByText("A question")).not.toBeInTheDocument();
    expect(screen.getByText("Another question")).toBeInTheDocument();
  });
});

describe("the conversation the list marks as open", () => {
  // A layout is never given the `chatId` segment, so this comes from the URL.
  it("takes the one the URL names", () => {
    nav.pathname = "/w/w1/c/chat-2";

    renderWorkspace({
      documents: [doc(READY)],
      chats: [
        {
          id: "chat-1",
          title: "First",
          updatedAt: new Date(),
          messageCount: 2,
        },
        {
          id: "chat-2",
          title: "Second",
          updatedAt: new Date(),
          messageCount: 4,
        },
      ],
    });

    expect(screen.getByRole("link", { name: /Second/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("falls back to the most recent when the URL names none", () => {
    // `/w/<id>` opens the last-used conversation, and `listChats` is ordered by
    // `updatedAt` descending — so the first row is the one the page opened.
    renderWorkspace({
      documents: [doc(READY)],
      chats: [
        {
          id: "chat-1",
          title: "First",
          updatedAt: new Date(),
          messageCount: 2,
        },
        {
          id: "chat-2",
          title: "Second",
          updatedAt: new Date(),
          messageCount: 4,
        },
      ],
    });

    expect(screen.getByRole("link", { name: /First/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
