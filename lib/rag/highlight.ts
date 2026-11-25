/**
 * The last link in the chain the offsets exist for:
 * `contentText.slice(charStart, charEnd)` should be exactly the passage that was
 * embedded, quoted and cited. "Should be" is doing work there, which is why this
 * checks rather than assumes.
 */

export type CitationHighlight = {
  before: string;
  cited: string;
  after: string;
  /** False means the document changed underneath the citation, so the offsets now
   * point elsewhere. Highlighting the wrong passage confidently is the worst
   * failure this product can have — precise-looking and wrong. */
  matchesQuote: boolean;
};

/** A PDF breaks lines where the page ran out, and a break before a lowercase word
 * is one of those. One character for one, so every stored offset still holds. */
export function unwrapForDisplay(text: string): string {
  return text.replace(/(?<!\n)\n(?=\p{Ll})/gu, " ");
}

export function highlightForCitation(
  text: string,
  citation: { charStart: number; charEnd: number; quote: string },
): CitationHighlight {
  // Offsets are UTF-16 code units, matching JavaScript string indexing and
  // Postgres `text` — the same units chunking measured in.
  const start = Math.max(0, Math.min(citation.charStart, text.length));
  const end = Math.max(start, Math.min(citation.charEnd, text.length));

  const display = unwrapForDisplay(text);

  return {
    before: display.slice(0, start),
    cited: display.slice(start, end),
    after: display.slice(end),
    matchesQuote: text.slice(start, end) === citation.quote,
  };
}
