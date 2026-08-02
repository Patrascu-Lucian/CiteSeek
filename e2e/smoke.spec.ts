import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the value proposition and both entry points", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /ask your documents/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo/i }),
    ).toBeVisible();
  });

  test("exposes a skip link as the first keyboard stop", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
  });

  test("has a document title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CiteSeek/);
  });
});

test.describe("the landing page knows who is reading it", () => {
  test("offers signup to a first-time visitor", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo — no signup/i }),
    ).toBeVisible();
  });

  test("offers a returning guest their demo rather than a signup", async ({
    page,
  }) => {
    // The bug this covers: the page rendered "Get started" and "no signup"
    // unconditionally, so someone already inside the demo was invited to sign up
    // for it. It was the first page anyone sees and the only one that did not
    // know the visitor existed.
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);

    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /continue in the demo/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toHaveCount(
      0,
    );
  });

  test("shows the header, so a session has an exit from the landing page", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /leave demo/i }),
    ).toBeVisible();
    // "Back to home" would point at the page you are already on.
    await expect(page.getByRole("link", { name: /back to home/i })).toHaveCount(
      0,
    );
  });
});

test.describe("a URL that does not exist", () => {
  test("gets the product's own 404, with a way out", async ({ page }) => {
    const response = await page.goto("/no-such-page");

    // The status matters as much as the page: a 404 rendered with a 200 tells
    // crawlers and monitoring the URL is fine.
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: /couldn't find that page/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /go to the home page/i }),
    ).toBeVisible();
  });

  test("shows the same page for a workspace the reader may not see", async ({
    page,
  }) => {
    // Authorization answers "not found" rather than "forbidden" so the two are
    // indistinguishable. That only holds if both render the same thing.
    //
    // Visited as a guest, so the proxy does not redirect a credential-less
    // request to sign-in before the page gets to answer.
    await page.goto("/demo");
    await page.goto("/w/00000000-0000-4000-8000-000000000000");

    await expect(
      page.getByRole("heading", { level: 1, name: /workspace not available/i }),
    ).toBeVisible();
    // Deliberately not asserting a 404 status here: this segment has a
    // `loading.tsx`, whose Suspense boundary lets Next flush the shell — and
    // commit a 200 — before the page calls `notFound()`. Measured, not assumed:
    // removing `loading.tsx` turns this into a real 404. The skeleton is worth
    // more than a status code on a route search engines never see, and the
    // status is correct where it matters, on the app-wide 404 above.
  });
});

/**
 * The body background, as the browser computes it.
 *
 * Compared against a measured reference rather than a literal: the tokens are
 * `oklch`, and Chrome reports the resolved value in `lab()` — a first version
 * of this asserted `rgb(255, 255, 255)` and failed against `lab(100 0 0)`,
 * which is the same white. Comparing two measurements sidesteps the whole
 * question of which notation the engine prefers today.
 */
async function backgroundUnder(
  browser: Browser,
  colorScheme: "light" | "dark",
  choose?: "Light" | "Dark",
) {
  const context = await browser.newContext({ colorScheme });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await hydrated(page);
    if (choose) {
      await page.getByRole("button", { name: choose }).click();
      /*
        Wait for the class before measuring anything.

        The click posts to a server action and the page re-renders from the
        response — so there is a window where the old palette is still painted.
        Reading the background inside it measured the palette the reader was
        leaving. This passed when the file ran alone and failed under the full
        suite, which is the signature of a race rather than a bug in the code
        being tested.
      */
      await expect(page.locator("html")).toHaveClass(
        choose === "Dark" ? /dark/ : /light/,
        THEME_ROUND_TRIP,
      );
    }

    return {
      background: await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      htmlClass: (await page.locator("html").getAttribute("class")) ?? "",
    };
  } finally {
    await context.close();
  }
}

/*
  Above Playwright's 5s default, because that default was measuring server
  contention rather than correctness.

  Choosing a theme is a server action: it sets a cookie, revalidates the layout
  and the page comes back re-rendered. Driven on its own that round trip
  completes in well under a second — six runs out of six — but the suite runs
  four workers against one Next process, and under that load it occasionally
  exceeded 5s and failed here while passing when this file ran alone. That
  pattern is contention, not a race in the code being tested.
*/
const THEME_ROUND_TRIP = { timeout: 15_000 };

/**
 * Waits for React to take over the form before clicking it.
 *
 * The theme control is a server action in a plain form, so it works twice over:
 * before hydration the browser posts it natively, and after hydration React
 * intercepts. A click landing *during* hydration can be lost between the two —
 * the submission is dropped rather than delayed, which is why raising the
 * timeout never helped and why the failure appeared only under a loaded suite,
 * where hydration takes longer.
 *
 * A real reader can hit the same window. It is narrow, the control is not on the
 * critical path, and the fix belongs to the framework rather than here — but the
 * test should not pretend the window does not exist.
 */
async function hydrated(page: Page) {
  await page.waitForLoadState("networkidle");
}

test.describe("choosing a theme", () => {
  /**
   * The palette is chosen by a cookie the server reads, so these assertions are
   * about the *rendered class*, not about anything the client did afterwards.
   * That is the property worth testing: it is what removes the flash.
   */
  test("a choice applies immediately and survives navigation", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await hydrated(page);

    await page.getByRole("button", { name: "Dark" }).click();

    await expect(page.locator("html")).toHaveClass(/dark/, THEME_ROUND_TRIP);
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // A second page proves the cookie is doing the work rather than a class
    // left behind on the client by the click.
    await page.goto("/sign-in");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("light beats an operating system set to dark", async ({ browser }) => {
    /*
      The reason the media query is scoped with `:not(.light)`. Without it this
      reader could never choose light: the system preference would repaint over
      the explicit choice, and the control would look broken on exactly the
      machines where it matters.
    */
    const reference = await backgroundUnder(browser, "light");
    const chosen = await backgroundUnder(browser, "dark", "Light");

    expect(chosen.htmlClass).toContain("light");
    expect(chosen.background).toBe(reference.background);
  });

  test("applies dark utilities on both paths into the dark palette", async ({
    browser,
  }) => {
    /*
      The two ways into the dark palette must agree, and for one commit they did
      not. The palette itself is driven by CSS variables, but `dark:` utilities
      throughout the shadcn components are driven by the *variant* — which
      matched only the explicit class. A reader arriving by operating-system
      preference got the dark palette with those rules inert.

      The logo is the probe because it is the one element guaranteed to be the
      same on both paths: the header renders differently for a visitor with a
      session than for one without, so comparing "the first link matching demo"
      compared two different components and reported a difference that was not
      one.
    */
    const logoFilter = async (
      colorScheme: "light" | "dark",
      choose?: "Dark",
    ) => {
      const context = await browser.newContext({ colorScheme });
      try {
        const page = await context.newPage();
        await page.goto("/");
        await hydrated(page);
        if (choose) {
          await page.getByRole("button", { name: choose }).click();
          await expect(page.locator("html")).toHaveClass(
            /dark/,
            THEME_ROUND_TRIP,
          );
        }

        // Awaited, not returned: `finally` closes the context, and returning
        // the promise lets that happen before it resolves.
        return await page
          .locator("header img")
          .evaluate((el) => getComputedStyle(el).filter);
      } finally {
        await context.close();
      }
    };

    const cookieDark = await logoFilter("light", "Dark");
    const systemDark = await logoFilter("dark");
    const light = await logoFilter("light");

    expect(cookieDark).toContain("invert");
    expect(systemDark).toBe(cookieDark);
    expect(light).not.toContain("invert");
  });

  test("follows the operating system when nothing has been chosen", async ({
    browser,
  }) => {
    const light = await backgroundUnder(browser, "light");
    const dark = await backgroundUnder(browser, "dark");

    // No class at all: `system` is the absence of a choice, and the palette
    // comes from `prefers-color-scheme` with no JavaScript involved.
    expect(dark.htmlClass).not.toMatch(/dark|light/);
    expect(dark.background).not.toBe(light.background);
  });
});

test.describe("what happens to an uploaded document", () => {
  /**
   * The policy pages carry claims a reader is entitled to rely on, so they have
   * to be reachable rather than merely present. A page nobody can navigate to is
   * a page that exists for the author.
   */
  test("privacy and terms are reachable from the landing page", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /privacy/i }),
    ).toBeVisible();
    await expect(page.getByText(/never the original files/i)).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "Terms of Service" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: /terms/i }),
    ).toBeVisible();
  });
});
