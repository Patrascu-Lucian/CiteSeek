import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  type Mock,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { ChatSource } from "@/lib/ai/types";

import { SourcePanel } from "./source-panel";

const CONTENT = "Before it. Expenses are reimbursed within 30 days. After it.";
const QUOTE = "Expenses are reimbursed within 30 days.";

function source(overrides: Partial<ChatSource> = {}): ChatSource {
  const charStart = CONTENT.indexOf(QUOTE);

  return {
    marker: 1,
    chunkId: "chunk-1",
    documentId: "doc-1",
    filename: "handbook.pdf",
    pageNumber: 3,
    charStart,
    charEnd: charStart + QUOTE.length,
    quote: QUOTE,
    ...overrides,
  };
}

function mockFetch(response: Partial<Response> & { json?: () => unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: response.json ?? (() => Promise.resolve({})),
      } as Response),
    ),
  );
}

function loaded(contentText: string | null = CONTENT) {
  mockFetch({ json: () => Promise.resolve({ document: { contentText } }) });
}

// Held as a reference rather than asserted through the prototype: reading a
// method off a prototype to assert on it detaches it from its receiver.
let scrollIntoView: Mock<Element["scrollIntoView"]>;

beforeEach(() => {
  // jsdom has no layout, so scrollIntoView is not implemented on elements.
  scrollIntoView = vi.fn<Element["scrollIntoView"]>();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPanel(props: Partial<Parameters<typeof SourcePanel>[0]> = {}) {
  const onClose = vi.fn();

  render(
    <SourcePanel
      source={source()}
      workspaceId="w1"
      onClose={onClose}
      {...props}
    />,
  );

  return { onClose };
}

describe("SourcePanel — the citation invariant, on screen", () => {
  it("highlights exactly the passage the answer quoted", async () => {
    loaded();
    renderPanel();

    // The whole chain, visible: offsets recorded at chunking time slice the
    // stored document back into precisely the cited text.
    const mark = await screen.findByText(QUOTE);
    expect(mark.tagName).toBe("MARK");
  });

  it("shows the document around the passage, not the passage alone", async () => {
    loaded();
    renderPanel();

    await screen.findByText(QUOTE);

    // A citation you cannot read around is barely better than no citation.
    expect(screen.getByText(/Before it\./)).toBeInTheDocument();
    expect(screen.getByText(/After it\./)).toBeInTheDocument();
  });

  it("scrolls the highlight into view once the text is rendered", async () => {
    loaded();
    renderPanel();

    await screen.findByText(QUOTE);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it("warns when the document no longer matches the citation", async () => {
    // Re-uploaded or re-extracted: the offsets now point somewhere else.
    loaded("Completely different text that does not contain the passage.");
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /document has changed/i,
    );
    // The quote captured at answer time is still shown, so the reader is not
    // left with nothing.
    expect(screen.getByText(QUOTE)).toBeInTheDocument();
  });
});

describe("SourcePanel — states", () => {
  it("says it is loading before the document arrives", () => {
    mockFetch({ json: () => new Promise(() => undefined) });
    renderPanel();

    expect(screen.getByText(/loading the source/i)).toBeInTheDocument();
  });

  it("falls back to the stored quote when the document was deleted", async () => {
    mockFetch({ ok: false, status: 404 });
    renderPanel();

    expect(await screen.findByText(/has been deleted/i)).toBeInTheDocument();
    // Deletion is real and cascades, so the citation degrades rather than
    // crashing the transcript.
    expect(screen.getByText(QUOTE)).toBeInTheDocument();
  });

  it("falls back to the stored quote when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn't be loaded/i,
    );
    expect(screen.getByText(QUOTE)).toBeInTheDocument();
  });

  it("explains when a document has no stored text", async () => {
    loaded(null);
    renderPanel();

    expect(
      await screen.findByText(/text is no longer stored/i),
    ).toBeInTheDocument();
  });

  it("renders nothing at all when no citation is open", () => {
    renderPanel({ source: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("SourcePanel — heading and dismissal", () => {
  it("names the document and the marker that opened it", async () => {
    loaded();
    renderPanel();

    expect(
      await screen.findByRole("heading", { name: "handbook.pdf" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cited as \[1\].*page 3/i)).toBeInTheDocument();
  });

  it("omits the page for formats that have none", async () => {
    loaded();
    renderPanel({ source: source({ pageNumber: null }) });

    expect(await screen.findByText(/cited as \[1\]$/i)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    loaded();
    const { onClose } = renderPanel();
    await screen.findByText(QUOTE);

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("closes from the close button", async () => {
    loaded();
    const { onClose } = renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: /close/i }),
    );

    expect(onClose).toHaveBeenCalled();
  });

  it("moves focus into the panel when it opens", async () => {
    loaded();
    renderPanel();
    await screen.findByText(QUOTE);

    // Not trapped — the panel is non-modal so the conversation stays reachable
    // — but focus has to land inside, or a keyboard user would activate a chip
    // and have nothing happen where their focus is.
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it("leaves the conversation behind it reachable", async () => {
    loaded();
    renderPanel();
    await screen.findByText(QUOTE);

    // A modal sheet marks everything behind it aria-hidden. Checking a citation
    // means reading the claim and the passage together, so it must not.
    expect(screen.getByRole("dialog")).not.toHaveAttribute(
      "aria-modal",
      "true",
    );
  });
});
