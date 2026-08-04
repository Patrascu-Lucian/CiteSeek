import { expect, test } from "@playwright/test";

const THUMB = '[data-slot="overlay-scrollbar-thumb"]';

/**
 * The defect: `scrollbar-gutter: stable` on `<html>` reserved 10px that no
 * element could paint into, so the header's full-bleed rule stopped 10px short
 * of the window edge on every page. Measured at 1270 in a 1280px window.
 */
test.describe("the page chrome reaches the window edge", () => {
  for (const path of ["/", "/about", "/terms"]) {
    test(`header and footer span the full width on ${path}`, async ({
      page,
    }) => {
      await page.goto(path);

      const width = await page.evaluate(() => window.innerWidth);

      for (const chrome of ["header", "footer"]) {
        const right = await page
          .locator(chrome)
          .first()
          .evaluate((el) => el.getBoundingClientRect().right);

        expect(right, `${chrome} on ${path}`).toBe(width);
      }
    });
  }

  test("no horizontal shift between a page that scrolls and one that does not", async ({
    page,
  }) => {
    // The property `scrollbar-gutter: stable` was there to buy, kept without it
    // by never reserving space in the first place.
    const navX = async (path: string) => {
      await page.goto(path);
      return page
        .locator("header nav")
        .evaluate((el) => el.getBoundingClientRect().x);
    };

    await page.setViewportSize({ width: 1280, height: 400 });
    const scrolling = await navX("/about");

    await page.setViewportSize({ width: 1280, height: 2400 });
    const notScrolling = await navX("/about");

    // `body` is `min-h-full`, so its height always equals the viewport — the
    // scrollability of the document is the only honest measure of the setup.
    expect(
      await page.evaluate(() => {
        const { scrollHeight, clientHeight } = document.documentElement;
        return scrollHeight > clientHeight;
      }),
    ).toBe(false);
    expect(notScrolling).toBe(scrolling);
  });
});

test.describe("the overlay scrollbar", () => {
  test("appears only when there is something to scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto("/about");
    await expect(page.locator(THUMB).first()).toBeVisible();

    // Tall enough that the page fits: a thumb with nowhere to travel is a
    // control that lies about the document's length.
    await page.setViewportSize({ width: 1280, height: 2400 });
    await expect(page.locator(THUMB)).toHaveCount(0);
  });

  test("tracks the scroll position and drags the page", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto("/about");

    const thumb = page.locator(THUMB).first();
    const topAt = async () =>
      thumb.evaluate((el) => el.getBoundingClientRect().top);

    const atRest = await topAt();
    expect(atRest).toBe(0);

    await page.mouse.wheel(0, 600);
    await expect.poll(topAt).toBeGreaterThan(atRest);

    // Dragging the thumb scrolls the document, which is the only reason it is
    // hit-testable at all — everything else here works without it.
    const box = (await thumb.boundingBox())!;
    const before = await page.evaluate(() => window.scrollY);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 80, {
      steps: 8,
    });
    await page.mouse.up();

    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });

  test("stays out of the accessibility tree and out of the way of clicks", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 400 });
    await page.goto("/about");

    // A fixed strip down the whole viewport that swallowed clicks would break
    // every control near the right edge; only the thumb is hit-testable.
    const track = page.locator('[data-slot="overlay-scrollbar"]').first();
    await expect(track).toHaveCSS("pointer-events", "none");
    await expect(page.locator(THUMB).first()).toHaveCSS(
      "pointer-events",
      "auto",
    );

    // It duplicates scrolling a screen reader already has, so it announces
    // nothing — the native control it replaces is not in the tree either.
    await expect(track).toHaveAttribute("aria-hidden", "true");
    expect(await page.locator("body").ariaSnapshot()).not.toContain(
      "scrollbar",
    );
  });
});
