import type { Page } from "@playwright/test";

/**
 * A click between paint and hydration is neither the browser's nor React's: a
 * server-action form loses the submission, a `<Link>` commits the URL and never
 * renders the destination. Measured at 3 failures in 120 runs, 0 in 80 with this
 * wait. A reader can hit it too — `docs/backlog.md`, not fixable here.
 *
 * `__reactFiber$` is the signal itself; `networkidle` was a stand-in that only
 * worked because prefetches kept the network busy.
 */
export async function hydrated(page: Page, selector: string) {
  await page.waitForFunction((sel) => {
    const node = document.querySelector(sel);
    return (
      node !== null &&
      Object.keys(node).some((key) => key.startsWith("__reactFiber$"))
    );
  }, selector);
}

/** The theme control, which is the one every palette spec drives. */
export const THEME_BUTTON = 'button[name="theme"]';

/** The guest exit on `/account` — a form posting a server action, so the same
 * dropped-click window as the theme control. */
export const GUEST_EXIT = 'form button[type="submit"]';

/** The wordmark, which is every page's way home. */
export const WORDMARK = 'header a[href="/"]';
