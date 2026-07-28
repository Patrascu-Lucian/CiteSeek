import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DocumentSummary } from "@/lib/documents/queries";

import { DocumentList } from "./document-list";

function document(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "doc-1",
    filename: "handbook.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    status: "ready",
    error: null,
    pageCount: 12,
    chunkCount: 30,
    embeddedChunkCount: 30,
    createdAt: new Date("2026-07-28T10:00:00Z"),
    updatedAt: new Date("2026-07-28T10:00:00Z"),
    ...overrides,
  };
}

describe("DocumentList — empty state", () => {
  it("tells a writer what to do next", () => {
    render(<DocumentList documents={[]} canWrite={true} />);

    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument();
    expect(screen.getByText(/upload a pdf/i)).toBeInTheDocument();
  });

  it("does not tell a read-only visitor to upload", () => {
    // Instructions someone cannot follow are worse than none.
    render(<DocumentList documents={[]} canWrite={false} />);

    expect(screen.queryByText(/upload a pdf/i)).not.toBeInTheDocument();
  });
});

describe("DocumentList — states", () => {
  it("shows passage and page counts for a ready document", () => {
    render(<DocumentList documents={[document()]} canWrite={true} />);

    expect(screen.getByText(/30 passages.*12 pages/)).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("shows embedding progress while processing", () => {
    // "Processing" alone gives no sense of whether a large document is moving
    // or stuck.
    render(
      <DocumentList
        documents={[
          document({
            status: "processing",
            chunkCount: 40,
            embeddedChunkCount: 12,
          }),
        ]}
        canWrite={true}
      />,
    );

    expect(screen.getByText("Processing 12/40")).toBeInTheDocument();
  });

  it("shows why a document failed", () => {
    // The error is the whole point of the failed state. A badge saying "Failed"
    // with no reason leaves the user with no action to take.
    render(
      <DocumentList
        documents={[
          document({
            status: "failed",
            error: "No text could be extracted from this PDF.",
          }),
        ]}
        canWrite={true}
      />,
    );

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText(/no text could be extracted/i)).toBeInTheDocument();
  });

  it("labels status in text, not only by color", () => {
    // Color alone fails for colorblind users and vanishes in high-contrast mode.
    render(
      <DocumentList
        documents={[document({ status: "queued" })]}
        canWrite={true}
      />,
    );

    expect(screen.getByText("Queued")).toBeInTheDocument();
  });
});

describe("DocumentList — permissions", () => {
  it("offers retry only on a failed document", () => {
    render(
      <DocumentList
        documents={[document({ status: "ready" })]}
        canWrite={true}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
  });

  it("offers retry when a document failed", () => {
    render(
      <DocumentList
        documents={[document({ status: "failed", error: "boom" })]}
        canWrite={true}
      />,
    );

    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("hides destructive actions from a read-only visitor", () => {
    render(
      <DocumentList
        documents={[document({ status: "failed", error: "boom" })]}
        canWrite={false}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /retry/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("names the document in the delete control", () => {
    // An icon-only button is unusable by screen reader without a label, and
    // "Delete" alone is ambiguous in a list of several documents.
    render(<DocumentList documents={[document()]} canWrite={true} />);

    expect(
      screen.getByRole("button", { name: "Delete handbook.pdf" }),
    ).toBeInTheDocument();
  });
});

describe("DocumentList — accessibility", () => {
  it("announces status changes politely", () => {
    // Polite, not assertive: a status update should not interrupt whatever a
    // screen-reader user is currently reading.
    const { container } = render(
      <DocumentList documents={[document()]} canWrite={true} />,
    );

    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("renders documents as a list", () => {
    render(
      <DocumentList
        documents={[document(), document({ id: "doc-2" })]}
        canWrite={true}
      />,
    );

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });
});
