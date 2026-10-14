import { describe, expect, it } from "vitest";

import type { ChatSource } from "./types";
import {
  CITATION_HREF_PREFIX,
  citationLabel,
  citedMarkers,
  linkCitationMarkers,
  markerVerdict,
  opensWithRefusal,
  unresolvedMarkers,
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

describe("unresolvedMarkers", () => {
  it("names the number the model invented", () => {
    expect(unresolvedMarkers("A claim [7].", [source()])).toEqual([7]);
  });

  it("says nothing when every marker resolves", () => {
    expect(unresolvedMarkers("A claim [1].", [source()])).toEqual([]);
  });

  it("reports each invented number once, in order", () => {
    // The same fabricated marker twice is one thing to tell the reader.
    const text = "First [5], then [3], then [5] again.";

    expect(unresolvedMarkers(text, [source()])).toEqual([3, 5]);
  });

  it("picks the invented number out of a group that also has a real one", () => {
    // `linkCitationMarkers` leaves the whole run literal, so [1] is unlinked
    // too; the number worth naming is the one that does not exist.
    expect(unresolvedMarkers("Both [1][9] agree.", [source()])).toEqual([9]);
  });

  it("treats every marker as invented when nothing was retrieved", () => {
    expect(unresolvedMarkers("A claim [1].", [])).toEqual([1]);
  });

  it("ignores a bracket that is a markdown link, not a marker", () => {
    // The same negative lookahead `linkCitationMarkers` relies on: `[1](url)`
    // is a link the model wrote, not a citation.
    expect(
      unresolvedMarkers("See [9](https://x.example).", [source()]),
    ).toEqual([]);
  });
});

describe("citedMarkers", () => {
  it("reports the markers a passage actually backs", () => {
    expect(citedMarkers("A claim [1].", [source()])).toEqual([1]);
  });

  it("is empty when the answer pointed at nothing", () => {
    // The case worth telling the reader about: passages were found and the
    // model cited none of them.
    expect(citedMarkers("You can upload up to 2 files.", [source()])).toEqual(
      [],
    );
  });

  it("does not count a number the model invented", () => {
    expect(citedMarkers("A claim [7].", [source()])).toEqual([]);
  });

  it("ignores a bare number that is not a marker", () => {
    // "up to 2 files" must not read as a citation of passage 2.
    expect(
      citedMarkers("Up to 2 files, over 30 days.", [
        source({ marker: 2 }),
        source({ marker: 30, chunkId: "c30" }),
      ]),
    ).toEqual([]);
  });
});

describe("opensWithRefusal", () => {
  it("recognizes the declining form rule 7 asks for", () => {
    expect(opensWithRefusal("The documents do not cover parking.")).toBe(true);
  });

  it("reads past leading whitespace and an opening quote", () => {
    expect(opensWithRefusal("  The documents do not cover parking.")).toBe(
      true,
    );
    expect(opensWithRefusal("“The documents do not cover parking.”")).toBe(
      true,
    );
  });

  it("does not care about the opener's case", () => {
    expect(opensWithRefusal("the documents do not cover parking.")).toBe(true);
  });

  it("counts the opener only at the start", () => {
    // An answer can quote the phrase; only a reply that opens with it declines.
    expect(
      opensWithRefusal(
        "Parking is free [1]. The documents do not cover tolls.",
      ),
    ).toBe(false);
  });

  it("does not stretch to a near miss, on purpose", () => {
    // Measured once in sixty committed replies, and missed here by design: the
    // looser match would also take the true answer below (ADR 058).
    expect(
      opensWithRefusal("The documents do not specify which inhibitor [3]."),
    ).toBe(false);
    expect(
      opensWithRefusal(
        "The documents do not require a certificate for seven days or fewer [3].",
      ),
    ).toBe(false);
  });
});

describe("a declining reply's markers", () => {
  const three = [
    source({ marker: 1 }),
    source({ marker: 2, chunkId: "chunk-2" }),
    source({ marker: 3, chunkId: "chunk-3" }),
  ];
  const declining =
    "The documents do not cover the warranty; they mention the guard [1][2] and storage [3].";

  it("are left as text, though every one resolves", () => {
    expect(linkCitationMarkers(declining, three)).toBe(declining);
  });

  it("are neither linked nor reported as invented", () => {
    // One situation, one note: a declining reply is not also told its marker
    // was invented.
    expect(
      markerVerdict("The documents do not cover the warranty [1][9].", three),
    ).toEqual({ linked: [], invented: [], declined: true });
  });

  it("do not make a reply without markers a declined one", () => {
    // Nothing was unlinked, so there is nothing to explain.
    expect(markerVerdict("The documents do not cover parking.", three)).toEqual(
      { linked: [], invented: [], declined: false },
    );
  });
});

describe("markerVerdict", () => {
  const two = [source({ marker: 1 }), source({ marker: 2, chunkId: "c2" })];

  it("lists exactly the markers drawn as chips", () => {
    // `[1][7]` is all or nothing, so its `1` is not a chip; `[2]` is.
    expect(markerVerdict("Mixed [1][7], then [2] and [2].", two)).toEqual({
      linked: [2],
      invented: [7],
      declined: false,
    });
  });
});
