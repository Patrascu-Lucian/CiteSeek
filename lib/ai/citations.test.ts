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

  it("rewrites a grouped marker as one chip per source", () => {
    // Observed in production: told that a sentence may carry several markers,
    // the model writes [1, 2] rather than [1][2]. A single-number pattern misses
    // it entirely and the citation renders as dead text.
    const linked = linkCitationMarkers("Both agree [1, 2].", [
      source({ marker: 1 }),
      source({ marker: 2, chunkId: "chunk-2" }),
    ]);

    expect(linked).toBe(
      `Both agree [1](${CITATION_HREF_PREFIX}1) [2](${CITATION_HREF_PREFIX}2).`,
    );
  });

  it("accepts a group written without spaces", () => {
    const linked = linkCitationMarkers("Both [1,2] agree.", [
      source({ marker: 1 }),
      source({ marker: 2, chunkId: "chunk-2" }),
    ]);

    expect(linked).toContain(`[1](${CITATION_HREF_PREFIX}1)`);
    expect(linked).toContain(`[2](${CITATION_HREF_PREFIX}2)`);
  });

  it("handles a group of three", () => {
    const sources = [1, 2, 3].map((marker) =>
      source({ marker, chunkId: `chunk-${marker}` }),
    );

    expect(linkCitationMarkers("All [1, 2, 3] agree.", sources)).toBe(
      `All [1](${CITATION_HREF_PREFIX}1) [2](${CITATION_HREF_PREFIX}2) [3](${CITATION_HREF_PREFIX}3) agree.`,
    );
  });

  it("separates adjacent markers so two chips do not read as one number", () => {
    // The model writes [3][5]. On screen the chips are distinct either way, but
    // copying the answer flattens them to "35" — a marker that cannot exist,
    // since retrieval returns at most eight passages.
    const linked = linkCitationMarkers("Both [3][5] agree.", [
      source({ marker: 3, chunkId: "chunk-3" }),
      source({ marker: 5, chunkId: "chunk-5" }),
    ]);

    expect(linked).toBe(
      `Both [3](${CITATION_HREF_PREFIX}3) [5](${CITATION_HREF_PREFIX}5) agree.`,
    );
  });

  it("separates an adjacent run of three", () => {
    const sources = [1, 2, 3].map((marker) =>
      source({ marker, chunkId: `chunk-${marker}` }),
    );

    expect(linkCitationMarkers("All [1][2][3].", sources)).toBe(
      `All [1](${CITATION_HREF_PREFIX}1) [2](${CITATION_HREF_PREFIX}2) [3](${CITATION_HREF_PREFIX}3).`,
    );
  });

  it("leaves an adjacent run alone when any member is invented", () => {
    const text = "Both [1][7] agree.";

    expect(linkCitationMarkers(text, [source({ marker: 1 })])).toBe(text);
  });

  it("leaves a group alone when any member is invented", () => {
    // All or nothing. Linking only the resolvable half would silently drop the
    // invented one and make the answer look better sourced than it is.
    const text = "Both [1, 7] agree.";

    expect(linkCitationMarkers(text, [source({ marker: 1 })])).toBe(text);
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
