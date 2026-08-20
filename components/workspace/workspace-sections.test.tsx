import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatUIMessage } from "@/lib/ai/types";
import type { DocumentSummary } from "@/lib/documents/queries";

import { WorkspaceSections } from "./workspace-sections";

/**
 * `useRouter` throws "expected app router to be mounted" outside Next's runtime.
 * `refresh` is what re-renders the server data behind the conversation list, so
 * it is observed rather than merely stubbed.
 */
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** The action reaches Auth.js through `authorizeWorkspace`, which has no server
 * to run in here. Its own behaviour is covered in `actions.integration.test.ts`. */
vi.mock("@/lib/chats/actions", () => ({ createConversation: vi.fn() }));

/**
 * `useChat` owns a network connection. The stub keeps `onFinish` so a test can
 * end a turn — the connection ending is the event this component reacts to.
 */
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

      /*
        `useState`, not `options.messages` returned directly.

        The real `useChat` seeds from the prop **once per mount** and then owns
        its state, or a streaming answer would be wiped by every re-render. A
        mock that echoed the prop back would follow it on every render — and a
        test written against that mock would pass whether or not the transcript
        actually follows the conversation, which is the exact bug below.
      */
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
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderSections(initialDocuments: DocumentSummary[], signedIn = true) {
  render(
    <WorkspaceSections
      workspaceId="w1"
      initialDocuments={initialDocuments}
      initialMessages={[]}
      chats={[]}
      activeChatId={null}
      canWrite
      signedIn={signedIn}
      isDemo={false}
    />,
  );
}

const READY = {
  status: "ready",
  chunkCount: 3,
  embeddedChunkCount: 3,
} as const;

describe("WorkspaceSections — the conversation list after a turn", () => {
  it("refetches the server data once an answer has finished", () => {
    /*
      The regression this exists for. Titles and message counts are rendered on
      the server from the database, and nothing told them a turn had happened:
      the count beside a conversation stayed at its old value until the reader
      reloaded, and the title generated from a first question never appeared.
    */
    renderSections([doc(READY)]);

    expect(router.refresh).not.toHaveBeenCalled();

    chat.onFinish?.();

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("does not refetch for a guest, who has no stored conversation", () => {
    // Guest turns are never written down, so a refetch would re-render the same
    // markup and spend a request saying nothing changed.
    renderSections([doc(READY)], false);

    chat.onFinish?.();

    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("WorkspaceSections — chat follows the document list", () => {
  it("opens the composer when a processing document becomes ready", async () => {
    // The regression this exists for. `hasReadyDocuments` used to be computed
    // during the server render and passed down, so an upload updated the
    // document list by polling while chat kept the value it was born with and
    // stayed on "Nothing to search yet" until a manual reload.
    pollReturns([
      doc({ status: "ready", chunkCount: 3, embeddedChunkCount: 3 }),
    ]);
    renderSections([doc({ status: "processing" })]);

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
    renderSections([doc({ status: "processing" })]);

    // Every question here would retrieve nothing and get the same refusal,
    // which reads like a broken feature rather than an unfinished upload.
    expect(screen.getByText(/nothing to search yet/i)).toBeInTheDocument();
  });

  it("offers the composer immediately when a document is already ready", () => {
    renderSections([doc({ status: "ready", chunkCount: 3 })]);

    expect(
      screen.getByRole("textbox", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("renders both sections under their own headings", () => {
    renderSections([doc({ status: "ready" })]);

    expect(
      screen.getByRole("heading", { level: 2, name: /documents/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /ask/i }),
    ).toBeInTheDocument();
  });

  it("hides the upload control from a read-only visitor and explains why", () => {
    render(
      <WorkspaceSections
        workspaceId="w1"
        initialDocuments={[doc({ status: "ready" })]}
        initialMessages={[]}
        chats={[]}

        activeChatId={null}

        canWrite={false}
        signedIn={false}
        isDemo={false}
      />,
    );

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
});

describe("WorkspaceSections — when the open conversation goes away", () => {
  function renderWith(
    activeChatId: string | null,
    initialMessages: ChatUIMessage[],
  ) {
    return render(
      <WorkspaceSections
        workspaceId="w1"
        initialDocuments={[doc(READY)]}
        initialMessages={initialMessages}
        chats={[]}
        activeChatId={activeChatId}
        canWrite
        signedIn
        isDemo={false}
      />,
    );
  }

  const answered: ChatUIMessage[] = [
    { id: "m1", role: "user", parts: [{ type: "text", text: "A question" }] },
  ];

  it("clears the transcript when the last conversation is deleted", () => {
    /*
      The regression this exists for. `useChat` seeds from `initialMessages`
      once and then owns its state, so a refreshed page handing it an empty
      list changed nothing: the deleted conversation's messages stayed on
      screen with no conversation behind them.
    */
    const { rerender } = renderWith("chat-1", answered);
    expect(screen.getByText("A question")).toBeInTheDocument();

    rerender(
      <WorkspaceSections
        workspaceId="w1"
        initialDocuments={[doc(READY)]}
        initialMessages={[]}
        chats={[]}
        activeChatId={null}
        canWrite
        signedIn
        isDemo={false}
      />,
    );

    expect(screen.queryByText("A question")).not.toBeInTheDocument();
    // The empty state's own line — "Ask a question about your documents" also
    // labels the composer, so it cannot tell the two apart.
    expect(screen.getByText(/answers cite the passages/i)).toBeInTheDocument();
  });

  it("shows the newly opened conversation when switching between them", () => {
    // The same defect seen from the other side, and the more damaging one: a
    // transcript that does not follow the conversation shows another one's.
    const { rerender } = renderWith("chat-1", answered);

    rerender(
      <WorkspaceSections
        workspaceId="w1"
        initialDocuments={[doc(READY)]}
        initialMessages={[
          {
            id: "m2",
            role: "user",
            parts: [{ type: "text", text: "A different question" }],
          },
        ]}
        chats={[]}
        activeChatId="chat-2"
        canWrite
        signedIn
        isDemo={false}
      />,
    );

    expect(screen.getByText("A different question")).toBeInTheDocument();
    expect(screen.queryByText("A question")).not.toBeInTheDocument();
  });
});

describe("WorkspaceSections — what happens to an uploaded file", () => {
  it("warns about the provider at the control, not only in the policy", () => {
    // Here, not on the dropzone: local mode shares that control, and there the
    // notice claimed a provider on a page that reaches none.
    renderSections([doc(READY)]);

    // The whole phrase inside one <strong>: an emphasis ending mid-clause loses
    // the space after it in JSX, which is how "extractedfrom" shipped once.
    expect(screen.getByText("paid Gemini tier")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /what is stored/i }),
    ).toHaveAttribute("href", "/privacy");
  });
});
