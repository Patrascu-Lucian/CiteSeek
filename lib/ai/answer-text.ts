import {
  DECLINED_MARKERS_NOTE,
  inventedMarkersNote,
  markerVerdict,
  sourceLocation,
} from "./citations";
import type { ChatSource } from "./types";

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
    .map((source) => `[${String(source.marker)}] ${sourceLocation(source)}`);

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
