import { describe, expect, it } from "vitest";

import type { ChatSource } from "./types";
import {
  CITATION_HREF_PREFIX,
  citationLabel,
  linkCitationMarkers,
  parseCitationHref,
} from "./citations";

function source(overrides: Partial<ChatSource> = {}): ChatSource {
  return {
    marker: 1,
    chunkId: "chunk-1",
    documentId: "doc-1",
    filename: "handbook.pdf",
    pageNumber: 3,
    charStart: 0,
    charEnd: 10,
    quote: "some text",
    ...overrides,
  };
}

describe("linkCitationMarkers", () => {
  it("rewrites a marker that has a source behind it", () => {
    const text = "Expenses are paid in 30 days [1].";

    expect(linkCitationMarkers(text, [source()])).toBe(
      `Expenses are paid in 30 days [1](${CITATION_HREF_PREFIX}1).`,
    );
  });

  it("leaves a marker with no matching source as plain text", () => {
    // The anti-hallucination property, made visible: an invented [7] has
    // nothing to link to, so it never becomes a chip.
    const text = "A claim [7] with no passage behind it.";

    expect(linkCitationMarkers(text, [source()])).toBe(text);
  });

  it("rewrites several markers in one sentence", () => {
    const text = "Both [1] and [2] agree.";

    const linked = linkCitationMarkers(text, [
      source({ marker: 1 }),
      source({ marker: 2, chunkId: "chunk-2" }),
    ]);

    expect(linked).toBe(
      `Both [1](${CITATION_HREF_PREFIX}1) and [2](${CITATION_HREF_PREFIX}2) agree.`,
    );
  });

  it("leaves an existing markdown link alone", () => {
    // `[1](https://…)` is a link the model wrote, not a citation marker.
    const text = "See [1](https://example.com) for details.";

    expect(linkCitationMarkers(text, [source()])).toBe(text);
  });

  it("returns the text unchanged when there are no sources", () => {
    const text = "A refusal mentions no passages [1].";

    expect(linkCitationMarkers(text, [])).toBe(text);
  });

  it("leaves bracketed non-numbers alone", () => {
    const text = "An array literal [x] and a footnote [note].";

    expect(linkCitationMarkers(text, [source()])).toBe(text);
  });
});

describe("parseCitationHref", () => {
  it("reads the marker out of a citation href", () => {
    expect(parseCitationHref(`${CITATION_HREF_PREFIX}2`)).toBe(2);
  });

  it("returns null for an ordinary link", () => {
    expect(parseCitationHref("https://example.com")).toBeNull();
    expect(parseCitationHref("#some-heading")).toBeNull();
  });

  it("returns null for a missing href", () => {
    expect(parseCitationHref(undefined)).toBeNull();
  });

  it("rejects a non-numeric or zero marker", () => {
    expect(parseCitationHref(`${CITATION_HREF_PREFIX}abc`)).toBeNull();
    expect(parseCitationHref(`${CITATION_HREF_PREFIX}0`)).toBeNull();
  });
});

describe("citationLabel", () => {
  it("names the document and page, not just the number", () => {
    // "1" read aloud on its own says nothing about what opening it will show.
    expect(citationLabel(source())).toBe("Citation 1: handbook.pdf, page 3");
  });

  it("omits the page for formats that have none", () => {
    expect(
      citationLabel(source({ pageNumber: null, filename: "notes.md" })),
    ).toBe("Citation 1: notes.md");
  });
});
