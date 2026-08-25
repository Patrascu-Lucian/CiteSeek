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
  if (sources.length === 0) return text;

  const known = new Set(sources.map((source) => source.marker));

  return text.replace(GROUPED_MARKER, (whole) => {
    const markers = (whole.match(MARKER_NUMBER) ?? []).map(Number);

    // All or nothing: rendering the valid half of a half-invented group would
    // quietly drop the invented one and make the answer look better sourced.
    if (!markers.every((marker) => known.has(marker))) return whole;

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
 * once so the two readings above cannot come to disagree about what a marker is. */
function markersIn(text: string): number[] {
  return [...text.matchAll(GROUPED_MARKER)].flatMap((match) =>
    (match[0].match(MARKER_NUMBER) ?? []).map(Number),
  );
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

/** The label a screen reader hears instead of a bare number. */
export function citationLabel(source: ChatSource): string {
  const page = source.pageNumber === null ? "" : `, page ${source.pageNumber}`;

  return `Citation ${source.marker}: ${source.filename}${page}`;
}
