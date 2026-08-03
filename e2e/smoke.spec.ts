import type { Browser, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { hydrated as waitForHydration, THEME_BUTTON } from "./hydration";

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

    // A guest's session is visible through the nav it gets, not through an exit
    // control — the header spends that slot on signing in instead.
    await expect(
      page
        .getByRole("navigation", { name: /main/i })
        .getByRole("link", { name: /account/i }),
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
    // Authorization answers "not found" rather than "forbidden", which only holds
    // if both render the same thing. As a guest, or the proxy redirects to
    // sign-in before the page can answer.
    await page.goto("/demo");
    await page.goto("/w/00000000-0000-4000-8000-000000000000");

    await expect(
      page.getByRole("heading", { level: 1, name: /workspace not available/i }),
    ).toBeVisible();
    // No status assertion: this segment's `loading.tsx` lets Next flush the shell
    // — committing a 200 — before `notFound()` runs. Measured: removing it turns
    // this into a real 404. The skeleton is worth more on a route crawlers never
    // see, and the status is asserted on the app-wide 404 above.
  });
});

/**
 * Compared against a measured reference, not a literal: the tokens are `oklch`
 * and Chrome resolves them to `lab()`, so `rgb(255, 255, 255)` failed against
 * `lab(100 0 0)` — the same white.
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
    // Waits for the class before measuring: the click re-renders from the server
    // response, and reading inside that window measured the palette being left.
    if (choose) await chooseTheme(page, choose);

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
  Above the 5s default, which was measuring contention rather than correctness:
  the theme round trip finishes well under a second alone, and only exceeds 5s
  with four workers against one Next process.
*/
const THEME_ROUND_TRIP = { timeout: 15_000 };

const hydrated = (page: Page) => waitForHydration(page, THEME_BUTTON);

/**
 * Retries the click, not just the assertion: `hydrated()` is necessary and not
 * sufficient, since React tags the node before the action is wired. A real reader
 * can hit the same window.
 */
async function chooseTheme(page: Page, label: "Light" | "Dark") {
  await expect(async () => {
    await page.getByRole("button", { name: label }).click();
    await expect(page.locator("html")).toHaveClass(
      label === "Dark" ? /dark/ : /light/,
      { timeout: 3_000 },
    );
  }).toPass(THEME_ROUND_TRIP);
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

    await chooseTheme(page, "Dark");

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
      The palette is CSS variables, but `dark:` utilities are driven by the
      variant — which for one commit matched only the explicit class, leaving them
      inert for a reader arriving by system preference. So the probe must carry a
      `dark:` utility: "Sign in to upload" has `dark:bg-input/30`.

      As a guest, since the landing page's calls to action differ per actor.
    */
    const probeBackground = async (
      colorScheme: "light" | "dark",
      choose?: "Dark",
    ) => {
      const context = await browser.newContext({ colorScheme });
      try {
        const page = await context.newPage();
        await page.goto("/demo");
        await hydrated(page);
        if (choose) {
          await chooseTheme(page, choose);
          // Reloaded, so the button is painted rather than mid-transition: the
          // probe carries `transition-all`, and reading it straight after the
          // click returned an interpolated alpha that matched neither palette.
          await page.reload();
          await hydrated(page);
        }

        // Awaited, not returned: `finally` closes the context, and returning
        // the promise lets that happen before it resolves.
        return await page
          .getByRole("link", { name: /^sign in to upload$/i })
          .evaluate((el) => getComputedStyle(el).backgroundColor);
      } finally {
        await context.close();
      }
    };

    const cookieDark = await probeBackground("light", "Dark");
    const systemDark = await probeBackground("dark");
    const light = await probeBackground("light");

    // The assertion is that the two dark paths agree *and* that dark differs
    // from light — without the second, two equally broken paths would pass.
    expect(systemDark).toBe(cookieDark);
    expect(cookieDark).not.toBe(light);
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

test.describe("about", () => {
  test("is reachable from a route that is not the landing page", async ({
    page,
  }) => {
    /*
      The property the root-layout footer exists for, and the one nothing
      asserted. A stranger deep in the app — reading a policy, or on a 404 —
      still has a route to what this project is.
    */
    await page.goto("/terms");
    await page.getByRole("link", { name: "About" }).click();

    await expect(page).toHaveURL(/\/about$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /about/i }),
    ).toBeVisible();
  });

  test("explains the guarantee a stranger cannot read the README for", async ({
    page,
  }) => {
    await page.goto("/about");

    await expect(
      page.getByText(/the model is never called at all/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo/i }),
    ).toBeVisible();
  });
});

test.describe("signing in from the header", () => {
  test("an anonymous reader can reach sign-in from a page that is not the landing page", async ({
    page,
  }) => {
    // The gap this closes: the nav is empty for someone with no session, so deep
    // in the app the only route to sign-in was back via the landing page.
    await page.goto("/terms");

    await page
      .getByRole("navigation", { name: /main/i })
      .getByRole("link", { name: /^sign in$/i })
      .click();

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("offers no sign-in to someone already on the sign-in page", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    await expect(
      page
        .getByRole("navigation", { name: /main/i })
        .getByRole("link", { name: /^sign in$/i }),
    ).toHaveCount(0);
  });

  test("offers a guest the way in rather than the way out", async ({
    page,
  }) => {
    // Signing in is what a guest might actually want; leaving read access to a
    // public demo is not, so that control moved to `/account`.
    await page.goto("/demo");

    const nav = page.getByRole("navigation", { name: /main/i });
    await expect(nav.getByRole("link", { name: /^sign in$/i })).toBeVisible();
    await expect(
      nav.getByRole("button", { name: /leave the demo/i }),
    ).toHaveCount(0);
  });
});

test.describe("the footer", () => {
  test("puts what this project is before the policies", async ({ page }) => {
    await page.goto("/");

    const links = await page
      .getByRole("navigation", { name: /about this project/i })
      .getByRole("link")
      .allInnerTexts();

    expect(links).toEqual([
      "About",
      "Contact",
      "Privacy Policy",
      "Terms of Service",
    ]);
  });
});
