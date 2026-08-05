import { expect, test } from "@playwright/test";

/** ADR 024: the bar counts in-flight `?_rsc=` requests. Both halves matter — it
 * has to rise for a navigation, and stay down for the prefetch burst on arrival. */
const BAR = "[data-navigation-progress]";

declare global {
  interface Window {
    __sawBar: boolean;
  }
}

test("stays down while the page prefetches links on arrival", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { level: 2, name: /ask/i }),
  ).toBeVisible();

  await page.waitForTimeout(2_000);

  await expect(page.locator(BAR)).toHaveCount(0);
});

test("rises during a navigation and clears afterward", async ({ page }) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { level: 2, name: /ask/i }),
  ).toBeVisible();
  await page.waitForTimeout(1_000);

  // Observed rather than polled: the bar can be up for less time than any
  // sampling interval, so a poll that misses it is a flake, not a finding.
  await page.evaluate(() => {
    window.__sawBar = false;
    new MutationObserver(() => {
      if (document.querySelector("[data-navigation-progress]"))
        window.__sawBar = true;
    }).observe(document.body, { childList: true, subtree: true });
  });

  await page
    .getByRole("link", { name: /^privacy/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/privacy$/, { timeout: 30_000 });

  expect(await page.evaluate(() => window.__sawBar)).toBe(true);

  // An indicator that never clears is worse than none.
  await expect(page.locator(BAR)).toHaveCount(0);
});
