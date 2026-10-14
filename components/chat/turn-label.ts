/** Long enough to identify the exchange, short enough to read as a title. */
const LABEL_LIMIT = 60;

/** Shared so a turn's controls name it the same way: several rows otherwise give
 * a screen reader a list of identically named buttons. */
export function shortenQuestion(question: string): string {
  const collapsed = question.replace(/\s+/g, " ").trim();

  return collapsed.length > LABEL_LIMIT
    ? `${collapsed.slice(0, LABEL_LIMIT).trimEnd()}…`
    : collapsed;
}
