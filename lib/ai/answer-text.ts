import {
  DECLINED_MARKERS_NOTE,
  inventedMarkersNote,
  markerVerdict,
  sourceLocation,
} from "./citations";
import type { ChatSource } from "./types";

/** Enough to tell two passages on one page apart, which "page 1" alone cannot. */
const EXCERPT_CHARS = 60;

/** Cut at a word, by code point, so an emoji or an accent is never halved. */
function excerpt(quote: string): string {
  const flat = quote.replace(/\s+/g, " ").trim();
  const chars = [...flat];
  if (chars.length <= EXCERPT_CHARS) return flat;

  const cut = chars.slice(0, EXCERPT_CHARS).join("");
  // A cut that lands just before a space already ends on a whole word.
  const space =
    chars[EXCERPT_CHARS] === " " ? cut.length : cut.lastIndexOf(" ");

  return `${space === -1 ? cut : cut.slice(0, space)}…`;
}

function sourceLine(source: ChatSource): string {
  const words = excerpt(source.quote);
  const line = `[${String(source.marker)}] ${sourceLocation(source)}`;

  return words ? `${line} — “${words}”` : line;
}

/**
 * An answer as text to paste somewhere else, which is where a citation has to
 * survive: the markers in the prose are `[n]`, and this is the list that says
 * what each `n` was. Only the markers the page linked — the retrieval sent
 * eight, and a paste that names a passage the page refused to link would read
 * better sourced than the page did (ADR 058).
 */
export function answerAsText(
  text: string,
  sources: readonly ChatSource[],
): string {
  const { linked, invented, declined } = markerVerdict(text, sources);

  const listed = sources
    .filter((source) => linked.includes(source.marker))
    .sort((a, b) => a.marker - b.marker)
    .map(sourceLine);

  const note = declined
    ? DECLINED_MARKERS_NOTE
    : invented.length > 0
      ? Object.values(inventedMarkersNote(invented)).join(" ")
      : null;

  return [
    text.trim(),
    ...(note ? [note] : []),
    ...(listed.length > 0 ? [`Sources:\n${listed.join("\n")}`] : []),
  ].join("\n\n");
}
