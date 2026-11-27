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
 * What the page reads as declining: the opener rule 7 asks for, and each phrase a
 * committed eval run caught opening a decline that is a decline in every use.
 * Never "The documents do not" alone: "do not require …" begins true answers
 * (ADR 058).
 */
const DECLINING_OPENERS = [
  DECLINING_OPENER,
  "The documents do not specify",
  "The documents do not mention",
];

export function opensWithRefusal(text: string): boolean {
  const opening = text
    .trimStart()
    .replace(/^["“']/, "")
    .toLowerCase();

  return DECLINING_OPENERS.some((opener) =>
    opening.startsWith(opener.toLowerCase()),
  );
}

const linkable = (run: readonly number[], known: ReadonlySet<number>) =>
  run.every((marker) => known.has(marker));

export function linkCitationMarkers(
  text: string,
  sources: readonly ChatSource[],
): string {
  if (sources.length === 0 || opensWithRefusal(text)) return text;

  const known = new Set(sources.map((source) => source.marker));
  let run = -1;

  return text.replace(GROUPED_MARKER, (whole) => {
    // Before the check below, so an unlinked run still counts, as in `claimAt`.
    run += 1;
    const markers = (whole.match(MARKER_NUMBER) ?? []).map(Number);

    // All or nothing: rendering the valid half of a half-invented group would
    // quietly drop the invented one and make the answer look better sourced.
    if (!linkable(markers, known)) return whole;

    // Space-separated, so the distinction survives being copied out of the page.
    return markers
      .map((marker) => `[${marker}](${CITATION_HREF_PREFIX}${marker}-${run})`)
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

const SENTENCES = new Intl.Segmenter("en", { granularity: "sentence" });
const RUN_AND_SPACE_BEFORE = new RegExp(
  String.raw`\s*` + GROUPED_MARKER.source,
  "g",
);
const LIST_SYNTAX = /^\s*(?:[-*+]|\d+[.)])(?=\s)/gm;
// Flanked as markdown requires, so "2 * 3 * 4" keeps its asterisks.
const STARRED = /(\*\*?)(?=\S)(.+?)(?<=\S)\1/g;
// Never inside a word, so `file_name` keeps its underscore.
const UNDERSCORED =
  /(?<![\p{L}\p{N}])(__?)(?=\S)(.+?)(?<=\S)\1(?![\p{L}\p{N}])/gu;

function plainText(markdown: string): string {
  return markdown
    .replace(RUN_AND_SPACE_BEFORE, "")
    .replace(LIST_SYNTAX, "")
    .replace(STARRED, "$2")
    .replace(UNDERSCORED, "$2")
    .replace(/\s+/g, " ")
    .trim();
}

/** A run that opens its sentence follows a full stop ("…25 days. [1]"), so it
 * cites the one before. */
export function claimAt(text: string, run: number): string | null {
  const marker = [...text.matchAll(GROUPED_MARKER)][run];
  if (marker === undefined) return null;

  const sentences = [...SENTENCES.segment(text)];
  let at = sentences.findLastIndex(({ index }) => index <= marker.index);
  if (at > 0 && text.slice(sentences[at]!.index, marker.index).trim() === "") {
    at -= 1;
  }

  return plainText(sentences[at]!.segment) || null;
}

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
  "This reply opens by declining, so its markers are not links.";

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

/** streamdown 2.8 sanitizes with a `user-content-` prefix, which it puts on
 * fragment links as well as on ids. */
const SANITIZED_CITATION_HREF_PREFIX = "#user-content-citation-";

const CITATION_FRAGMENT = /^(\d+)-(\d+)$/;

function readCitationHref(href: string | undefined) {
  if (href === undefined) return null;

  const prefix = [CITATION_HREF_PREFIX, SANITIZED_CITATION_HREF_PREFIX].find(
    (candidate) => href.startsWith(candidate),
  );
  if (prefix === undefined) return null;

  const fragment = CITATION_FRAGMENT.exec(href.slice(prefix.length));
  if (fragment === null) return null;

  const marker = Number(fragment[1]);
  return marker > 0 ? { marker, run: Number(fragment[2]) } : null;
}

export function parseCitationHref(href: string | undefined): number | null {
  return readCitationHref(href)?.marker ?? null;
}

export function citationRunOf(href: string | undefined): number | null {
  return readCitationHref(href)?.run ?? null;
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
