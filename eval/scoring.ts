/**
 * Shared so the Node harness and the browser one produce comparable numbers.
 * Two runs scored by two copies of this would differ for reasons that are not
 * the model, which is the whole question those runs exist to answer.
 */

// Not `includes`: "5%" matched inside "25%", scoring the cap as the rate.
export const grounds = (answer: string, wants: readonly string[]) =>
  wants.some((want) =>
    new RegExp(
      `(?<!\\d)${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "i",
    ).test(answer),
  );

/** In range, so a `[9]` against one passage does not count as cited. */
export const cites = (answer: string, sourceCount: number) =>
  [...answer.matchAll(/\[(\d+)\]/g)].some((match) => {
    const marker = Number(match[1]);
    return marker >= 1 && marker <= sourceCount;
  });
