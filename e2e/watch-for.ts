import type { Page } from "@playwright/test";

declare global {
  interface Window {
    /** Per selector, so two watchers on one page do not overwrite each other —
     * and so a reader can tell "never appeared" from "this document is not the
     * one that was watched". */
    __seen: Record<string, boolean>;
  }
}

/**
 * Records whether `selector` was ever in the DOM. Polling would race a node
 * replaced the moment its data lands.
 *
 * The reader throws rather than returning `false` when the document it watched
 * is gone — a full page load discards the observer, and reporting that as "never
 * appeared" is the wrong-and-convincing answer this exists to avoid.
 *
 * **Not proof against a node that is added and removed within one checkpoint**,
 * unless it was added as a node: an attribute set and cleared in the same batch
 * leaves no record either path can read. Selectors matching on an attribute of a
 * persisting element are the exposed case.
 */
export async function watchFor(page: Page, selector: string) {
  await page.evaluate((one) => {
    window.__seen ??= {};
    // Seeded, because a match already present fires no mutation of its own.
    window.__seen[one] = document.querySelector(one) !== null;

    new MutationObserver((records) => {
      if (window.__seen[one]) return;
      if (document.querySelector(one)) {
        window.__seen[one] = true;
        return;
      }

      // A node added and removed inside one checkpoint is gone by the time the
      // callback queries for it, but it is still in `addedNodes`. Attribute
      // records carry none, so they rely on the query above.
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches(one) || node.querySelector(one))
          ) {
            window.__seen[one] = true;
            return;
          }
        }
      }
    }).observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });
  }, selector);

  return async () => {
    const seen = await page.evaluate(
      (one) => (one in (window.__seen ?? {}) ? window.__seen[one] : null),
      selector,
    );

    if (seen === null) {
      throw new Error(
        `The page reloaded, so nothing watched for "${selector}" survived.`,
      );
    }
    return seen;
  };
}
