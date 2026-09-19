import type { ChatSource } from "./types";

/**
 * An answer as text to paste somewhere else, which is where a citation has to
 * survive: the markers in the prose are `[n]`, and this is the list that says
 * what each `n` was. Only the sources the answer actually cited — the retrieval
 * sent eight, and listing the seven it did not use would read as padding.
 */
export function answerAsText(
  text: string,
  sources: readonly ChatSource[],
  cited: readonly number[],
): string {
  const listed = sources
    .filter((source) => cited.includes(source.marker))
    .sort((a, b) => a.marker - b.marker)
    .map((source) => {
      const page =
        source.pageNumber === null ? "" : `, page ${source.pageNumber}`;

      return `[${String(source.marker)}] ${source.filename}${page}`;
    });

  const answer = text.trim();
  if (listed.length === 0) return answer;

  return `${answer}\n\nSources:\n${listed.join("\n")}`;
}
