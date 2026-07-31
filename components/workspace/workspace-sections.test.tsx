import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentSummary } from "@/lib/documents/queries";

import { WorkspaceSections } from "./workspace-sections";

/**
 * `useRouter` throws "expected app router to be mounted" outside Next's runtime.
 * The component uses it to re-render the server data after a conversation is
 * renamed or deleted; these tests are about documents and the composer, so the
 * refresh is stubbed rather than observed.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

/** `useChat` owns a network connection; the composer's presence is what matters here. */
vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    messages: [],
    status: "ready",
    error: undefined,
    sendMessage: vi.fn(),
    regenerate: vi.fn(),
    stop: vi.fn(),
    clearError: vi.fn(),
  }),
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
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderSections(initialDocuments: DocumentSummary[]) {
  render(
    <WorkspaceSections
      workspaceId="w1"
      initialDocuments={initialDocuments}
      initialMessages={[]}
      chats={[]}
      activeChatId={null}
      canWrite
      signedIn
    />,
  );
}

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
