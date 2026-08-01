import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentSummary } from "@/lib/documents/queries";

import { WorkspaceSections } from "./workspace-sections";

/**
 * `useRouter` throws "expected app router to be mounted" outside Next's runtime.
 * `refresh` is what re-renders the server data behind the conversation list, so
 * it is observed rather than merely stubbed.
 */
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/**
 * `useChat` owns a network connection. The stub keeps `onFinish` so a test can
 * end a turn — the connection ending is the event this component reacts to.
 */
const chat = vi.hoisted(() => ({
  onFinish: undefined as (() => void) | undefined,
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: { onFinish?: () => void }) => {
    chat.onFinish = options.onFinish;
    return {
      messages: [],
      status: "ready",
      error: undefined,
      sendMessage: vi.fn(),
      regenerate: vi.fn(),
      stop: vi.fn(),
      clearError: vi.fn(),
    };
  },
}));

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
