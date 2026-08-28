import type { Page } from "@playwright/test";

declare global {
  interface Window {
    __seen?: Record<string, boolean>;
  }
}

/**
 * Whether `selector` was ever in the DOM. Polling would race a node replaced the
 * moment its data lands.
 *
 * The reader throws rather than returning `false` once the document is gone:
 * "never appeared" would be wrong and convincing. Not proof against an attribute
 * set and cleared inside one checkpoint.
 */
export async function watchFor(page: Page, selector: string) {
  await page.evaluate((one) => {
    const seen = (window.__seen ??= {});
    // Seeded, because a match already present fires no mutation of its own.
    // `||=`, so a second watcher on the same selector cannot un-see the first.
    seen[one] ||= document.querySelector(one) !== null;

    new MutationObserver((records) => {
      if (seen[one]) return;
      if (document.querySelector(one)) {
        seen[one] = true;
        return;
      }

      // Gone by the time the callback queries, but still in `addedNodes`.
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (
            node instanceof Element &&
            (node.matches(one) || node.querySelector(one))
          ) {
            seen[one] = true;
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
      (one) => window.__seen?.[one] ?? null,
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
