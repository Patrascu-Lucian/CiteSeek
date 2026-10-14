import type { ChatSource } from "./types";

/**
 * Turning the markers a model writes into something clickable.
 *
 * Markdown renders from a string, not a React tree, so splitting text on markers
 * would cut emphasis and lists in half. Instead a marker is rewritten as a
 * markdown *link* before rendering, and the link renderer draws the chip.
 */

/** Fragment links survive markdown sanitization; a custom URI scheme would not. */
export const CITATION_HREF_PREFIX = "#citation-";

/**
 * A run of markers: `[1]`, `[1, 2]`, `[1][2]` — both spellings were observed on
 * the deployed app. Matching the whole run chooses the separator here rather than
 * inheriting it: on screen they look alike, but **copied as text** adjacent chips
 * flatten into "35". The negative lookahead leaves `[1](https://…)` alone.
 */
const GROUPED_MARKER = /(?:\[\d+(?:\s*,\s*\d+)*])+(?!\()/g;

const MARKER_NUMBER = /\d+/g;

/** Here rather than in `prompt.ts`, which imports it for rule 7: this module
 * runs in the browser, and the prompt has no reason to. */
export const DECLINING_OPENER = "The documents do not cover";

/**
 * Whether a reply is in the declining form rule 7 asks for. The exact opener and
 * nothing looser: "The documents do not require …" begins plenty of true answers
 * (ADR 058).
 */
export function opensWithRefusal(text: string): boolean {
  return text
    .trimStart()
    .replace(/^["“']/, "")
    .toLowerCase()
    .startsWith(DECLINING_OPENER.toLowerCase());
}

const linkable = (run: readonly number[], known: ReadonlySet<number>) =>
  run.every((marker) => known.has(marker));

/**
 * Rewrites `[n]` as `[n](#citation-n)`, but only for markers that resolve.
 *
 * An unresolvable marker stays literal text — the anti-hallucination property
 * made visible. Invent `[7]` when three passages were retrieved and there is
 * nothing to link to, so nothing renders as a chip.
 */
export function linkCitationMarkers(
  text: string,
  sources: readonly ChatSource[],
): string {
  if (sources.length === 0 || opensWithRefusal(text)) return text;

  const known = new Set(sources.map((source) => source.marker));

  return text.replace(GROUPED_MARKER, (whole) => {
    const markers = (whole.match(MARKER_NUMBER) ?? []).map(Number);

    // All or nothing: rendering the valid half of a half-invented group would
    // quietly drop the invented one and make the answer look better sourced.
    if (!linkable(markers, known)) return whole;

    // Space-separated, so the distinction survives being copied out of the page.
    return markers
      .map((marker) => `[${marker}](${CITATION_HREF_PREFIX}${marker})`)
      .join(" ");
  });
}

/**
 * The numbers an answer cited that no retrieved passage backs.
 *
 * `linkCitationMarkers` already refuses to link these, which is the guarantee.
 * This is what lets the reader be told — an inert number is indistinguishable
 * from a broken button, and the one moment the model is caught inventing a
 * source is the moment the page looks most broken (ADR 036).
 */
export function unresolvedMarkers(
  text: string,
  sources: readonly ChatSource[],
): number[] {
  return distinct(markersIn(text), sources, false);
}

/**
 * The markers an answer wrote that a retrieved passage does back.
 *
 * **Not the same as the chips on screen.** `linkCitationMarkers` is all or
 * nothing per run, so in `[1][9]` neither number is linked while this still
 * reports `[1]` — the model did point at a real passage, which is the question
 * this answers. Its emptiness is the interesting case: passages were found, the
 * model was called, and it pointed at none of them (ADR 037).
 */
export function citedMarkers(
  text: string,
  sources: readonly ChatSource[],
): number[] {
  return distinct(markersIn(text), sources, true);
}

/** Every marker written, in the runs `linkCitationMarkers` recognises — defined
 * once so the readings here cannot come to disagree about what a marker is. */
function runsIn(text: string): number[][] {
  return [...text.matchAll(GROUPED_MARKER)].map((match) =>
    (match[0].match(MARKER_NUMBER) ?? []).map(Number),
  );
}

const markersIn = (text: string) => runsIn(text).flat();

export type MarkerVerdict = {
  /** The markers drawn as chips: the only ones a copied source list may name. */
  linked: number[];
  invented: number[];
  /** A declining reply that carries markers, so none of them is a link. */
  declined: boolean;
};

/** What a reply's markers come to, decided once so the page and the clipboard
 * cannot disagree. One situation gets one note, so a declining reply is not also
 * told its `[7]` was invented. */
export function markerVerdict(
  text: string,
  sources: readonly ChatSource[],
): MarkerVerdict {
  if (opensWithRefusal(text) && markersIn(text).length > 0) {
    return { linked: [], invented: [], declined: true };
  }

  const known = new Set(sources.map((source) => source.marker));
  const linked = runsIn(text)
    .filter((run) => linkable(run, known))
    .flat();

  return {
    linked: [...new Set(linked)],
    invented: unresolvedMarkers(text, sources),
    declined: false,
  };
}

export const DECLINED_MARKERS_NOTE =
  "This reply declines the question, so its markers are not links.";

/** Split so the page can set the list in bold; the clipboard joins them. */
export function inventedMarkersNote(markers: readonly number[]): {
  list: string;
  explanation: string;
} {
  return {
    list: markers.map((marker) => `[${String(marker)}]`).join(", "),
    explanation:
      markers.length === 1
        ? "is not one of the passages found, so it is not a link. Treat that claim as unsupported."
        : "are not among the passages found, so they are not links. Treat those claims as unsupported.",
  };
}

const distinct = (
  markers: number[],
  sources: readonly ChatSource[],
  keepKnown: boolean,
) => {
  const known = new Set(sources.map((source) => source.marker));

  return [
    ...new Set(markers.filter((marker) => known.has(marker) === keepKnown)),
  ].sort((a, b) => a - b);
};

export function parseCitationHref(href: string | undefined): number | null {
  if (!href?.startsWith(CITATION_HREF_PREFIX)) return null;

  const marker = Number(href.slice(CITATION_HREF_PREFIX.length));

  return Number.isInteger(marker) && marker > 0 ? marker : null;
}

/** Shared with the clipboard's source list, so the chip a reader hears and the
 * line they paste cannot drift apart. */
export function sourceLocation(source: ChatSource): string {
  const page = source.pageNumber === null ? "" : `, page ${source.pageNumber}`;

  return `${source.filename}${page}`;
}

/** The label a screen reader hears instead of a bare number. */
export function citationLabel(source: ChatSource): string {
  return `Citation ${source.marker}: ${sourceLocation(source)}`;
}
