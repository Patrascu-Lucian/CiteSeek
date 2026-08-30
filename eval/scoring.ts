/**
 * Shared so the Node harness and the browser one produce comparable numbers.
 * Two runs scored by two copies of this would differ for reasons that are not
 * the model, which is the whole question those runs exist to answer.
 */

const quoted = (want: string) => want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* Not `includes`: "5%" matched inside "25%". Both edges, because a lookbehind
   alone still read "2000" out of "20000" and "90 kN" out of "90 kNm" — and this
   error only ever inflates. Per edge rather than `\b`: a want ending in "%" has
   no word character to bound. */
const bounded = (want: string) =>
  new RegExp(
    `${/^\w/.test(want) ? "(?<!\\w)" : ""}${quoted(want)}${/\w$/.test(want) ? "(?!\\w)" : ""}`,
    "i",
  );

export const grounds = (answer: string, wants: readonly string[]) =>
  wants.some((want) => bounded(want).test(answer));

/** In range, so a `[9]` against one passage does not count as cited. */
export const cites = (answer: string, sourceCount: number) =>
  [...answer.matchAll(/\[(\d+)\]/g)].some((match) => {
    const marker = Number(match[1]);
    return marker >= 1 && marker <= sourceCount;
  });
