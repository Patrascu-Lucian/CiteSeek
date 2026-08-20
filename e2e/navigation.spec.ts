import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** ADR 024. Only what needs a real browser is here — the threshold itself is a
 * unit test. */
const BAR = "[data-navigation-progress]";

declare global {
  interface Window {
    __sawBar: boolean;
  }
}

/** Records whether the bar was ever in the DOM, however briefly. Polling would
 * race the thing it is measuring. */
async function watchForBar(page: Page) {
  await page.evaluate(() => {
    window.__sawBar = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-navigation-progress]"))
        window.__sawBar = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
}

test("stays down while the page prefetches links on arrival", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { level: 2, name: /ask/i }),
  ).toBeVisible();

  await page.waitForTimeout(1_200);

  await expect(page.locator(BAR)).toHaveCount(0);
});

test("rises during a slow navigation and clears afterward", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /try the demo/i }).first(),
  ).toBeVisible();
  await page.waitForTimeout(400);

  /*
    Held past the threshold deliberately. Locally a route can resolve in well
    under it, and then the bar correctly never appears — a real navigation is
    not a reliable way to observe something that only shows when one is slow.
  */
  await page.route(/_rsc=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });

  await watchForBar(page);

  await page
    .getByRole("link", { name: /try the demo/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  expect(await page.evaluate(() => window.__sawBar)).toBe(true);

  // An indicator that never clears is worse than none.
  await expect(page.locator(BAR)).toHaveCount(0);
});
