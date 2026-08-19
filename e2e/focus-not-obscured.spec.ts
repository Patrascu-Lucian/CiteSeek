import { expect, test } from "@playwright/test";

/**
 * Measured: without `scroll-padding-top` in `globals.css`, "Skip to main content"
 * puts `#main` at top 0 under a 67px header — the affordance whose only users are
 * keyboard users, landing them behind the nav.
 */

test("the skip link clears the sticky header", async ({ page }) => {
  await page.goto("/privacy");

  // `banner`, not `header`: the workspace page has its own title <header>.
  const headerBox = await page.getByRole("banner").boundingBox();
  expect(headerBox).not.toBeNull();
  const headerBottom = headerBox!.y + headerBox!.height;

  // Keyboard, not `click()`: the link is `sr-only` until focused.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: /skip to main content/i }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector("#main")?.getBoundingClientRect().top ?? -1,
      ),
    )
    .toBeGreaterThanOrEqual(headerBottom);
});

/** The in-product instance: the cap refusal redirects to a fragment. Asserted on
 *  a heading a guest can reach — the scrolling belongs to the anchor, not to it. */
test("a workspace section anchor lands below the header", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForURL(/\/w\/[0-9a-f-]+/);

  const headerBox = await page.getByRole("banner").boundingBox();
  const headerBottom = headerBox!.y + headerBox!.height;

  await page.goto(`${page.url().split("#")[0]!}#chat-heading`);

  const box = await page
    .getByRole("heading", { level: 2, name: "Ask" })
    .boundingBox();

  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(headerBottom);
});
