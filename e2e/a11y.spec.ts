import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility checks across the surfaces a reader actually reaches.
 *
 * **axe is a floor, not the pass.** It is worth being precise about that here,
 * because "axe clean" reads like a stronger claim than it is. A citation chip in
 * this codebase once rendered in exactly the color of the bubble behind it:
 * correctly labeled, keyboard operable, `aria-pressed` toggling, invisible. Every
 * automated check passed, including the contrast rules — those compare text to
 * its background, and `text-muted-foreground` on `bg-muted` is a designed pair.
 * What failed was affordance, and nothing automated measures affordance.
 *
 * So this file catches the mechanical failures — missing names, bad contrast,
 * broken landmark structure — and the keyboard specs below it plus manual review
 * cover what it cannot see.
 */

/**
 * WCAG 2.2 AA, which is the bar the project claims.
 *
 * `best-practice` is deliberately excluded: it mixes genuine issues with
 * stylistic opinions, and a suite that fails on an opinion trains people to
 * ignore it.
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Runs axe and returns its violations reduced to something readable.
 *
 * A raw `expect(violations).toEqual([])` prints the entire rule object — every
 * tag, every related node, hundreds of lines — and buries the one sentence that
 * says what is wrong. This keeps the rule id, the impact, and the offending
 * markup, which is all anyone needs to start.
 */
async function violationsOn(page: Page, selector?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_AA);
  const results = await (
    selector ? builder.include(selector) : builder
  ).analyze();

  return results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.html),
  }));
}

/**
 * Reaching a workspace at all requires a credential.
 *
 * `proxy.ts` redirects a credential-less `/w/*` to `/sign-in`, so scanning that
 * URL directly would report a clean sign-in page and say nothing about the
 * workspace. Visiting `/demo` first mints the guest cookie and lands on the real
 * thing — the same reason the performance numbers have to be measured that way.
 */
async function gotoDemo(page: Page) {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { level: 2, name: /ask/i }),
  ).toBeVisible();
}

/**
 * Both palettes, over the same specs rather than a second copy of them.
 *
 * Dark mode doubles the accessibility surface, and that is its real cost. A
 * contrast pair that is fine in one palette can fail in the other, and the
 * duplicated-spec version of this file would drift the first time someone
 * updated only the copy they were looking at.
 *
 * The cookie is what selects the palette — the server reads it and writes the
 * class, so there is nothing to wait for on the client.
 */
const THEMES = ["light", "dark"] as const;

async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  // One navigation first, so the context has an origin to attach a cookie to.
  await page.goto("/");
  await page
    .context()
    .addCookies([{ name: "citeseek_theme", value: theme, url: page.url() }]);
}

for (const theme of THEMES) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(({ page }) => useTheme(page, theme));

    test("paints the palette it was asked for", async ({ page }) => {
      /*
        Guards the parameterisation itself. Without it, a broken cookie or a
        server that ignored it would run every check below against the light
        palette twice and report full coverage of both.
      */
      await page.goto("/");
      const classes = await page.locator("html").getAttribute("class");

      if (theme === "dark") expect(classes).toContain("dark");
      else expect(classes).toContain("light");
    });

    test.describe("automated accessibility", () => {
      test("the landing page", async ({ page }) => {
        await page.goto("/");

        expect(await violationsOn(page)).toEqual([]);
      });

      test("sign-in", async ({ page }) => {
        await page.goto("/sign-in");

        expect(await violationsOn(page)).toEqual([]);
      });

      test("the workspace, as a guest", async ({ page }) => {
        await gotoDemo(page);

        expect(await violationsOn(page)).toEqual([]);
      });

      test("a conversation with an answer and citations in it", async ({
        page,
      }) => {
        await gotoDemo(page);
        await page
          .getByRole("textbox", { name: /ask a question/i })
          .fill("When is reimbursement paid?");
        await page.getByRole("button", { name: /send/i }).click();
        await expect(
          page.getByRole("button", { name: /citation 1/i }),
        ).toBeVisible();

        // Scanned after the answer lands, not before: the chips, the live region and
        // the message list only exist once there is a conversation, and an empty
        // panel is not the state anyone reads.
        expect(await violationsOn(page)).toEqual([]);
      });

      test("the source panel, open", async ({ page }) => {
        await gotoDemo(page);
        await page
          .getByRole("textbox", { name: /ask a question/i })
          .fill("When is reimbursement paid?");
        await page.getByRole("button", { name: /send/i }).click();
        await page
          .getByRole("button", { name: /citation 1/i })
          .first()
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();

        expect(await violationsOn(page)).toEqual([]);
      });

      test("the privacy and terms pages", async ({ page }) => {
        // Long prose pages, which is where heading order and link contrast go
        // wrong quietly.
        await page.goto("/privacy");
        expect(await violationsOn(page)).toEqual([]);

        await page.goto("/terms");
        expect(await violationsOn(page)).toEqual([]);
      });

      test("the 404", async ({ page }) => {
        await page.goto("/no-such-page");

        expect(await violationsOn(page)).toEqual([]);
      });

      /**
       * The mobile menu, which is a second copy of the navigation and therefore a
       * second chance to get the landmarks wrong. The specific risk it introduced:
       * the header row already owns a `nav` named "Main", and a second one with the
       * same name is a duplicate landmark that axe does flag.
       */
      test("the navigation menu on a small screen, open", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoDemo(page);

        await page.getByRole("button", { name: /menu/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible();

        expect(await violationsOn(page)).toEqual([]);
      });
    });

    /**
     * The half axe cannot reach.
     *
     * Each of these encodes a specific way the automated pass gives a false
     * negative — a rule that is satisfied while the experience is broken.
     */
    test.describe("what automated checks cannot see", () => {
      test("a citation chip is distinguishable from the bubble behind it", async ({
        page,
      }) => {
        await gotoDemo(page);
        await page
          .getByRole("textbox", { name: /ask a question/i })
          .fill("When is reimbursement paid?");
        await page.getByRole("button", { name: /send/i }).click();

        const chip = page.getByRole("button", { name: /^Citation 1:/ });
        await expect(chip).toBeVisible();

        /*
      The regression this exists for: the chip was `bg-muted` on a `bg-muted`
      bubble. It was drawn every time, in exactly the color behind it — labeled,
      operable, `aria-pressed` toggling, and invisible.

      axe passed, and would pass again: its contrast rules compare *text* to its
      own background, and `text-muted-foreground` on `bg-muted` is a designed,
      compliant pair. Nothing automated measures whether a control announces
      itself as one. So this compares the two backgrounds directly.
    */
        const { chipBackground, bubbleBackground } = await chip.evaluate(
          (node) => {
            // No fallback ancestor on purpose. An earlier draft fell back to
            // `parentElement`, which is a transparent inline element — so the
            // comparison passed without ever looking at the bubble. A test that cannot
            // fail is worse than no test, so a missing marker is an error here.
            const bubble = node.closest("[data-message-bubble]");
            if (!bubble)
              throw new Error("No [data-message-bubble] ancestor found.");

            return {
              chipBackground: getComputedStyle(node).backgroundColor,
              bubbleBackground: getComputedStyle(bubble).backgroundColor,
            };
          },
        );

        expect(bubbleBackground).not.toBe("rgba(0, 0, 0, 0)");
        expect(chipBackground).not.toBe(bubbleBackground);
      });

      test("the source text can be scrolled by keyboard alone", async ({
        page,
      }) => {
        await gotoDemo(page);
        await page
          .getByRole("textbox", { name: /ask a question/i })
          .fill("When is reimbursement paid?");
        await page.getByRole("button", { name: /send/i }).click();
        await page
          .getByRole("button", { name: /^Citation 1:/ })
          .first()
          .click();

        const panel = page.getByRole("dialog");
        await expect(panel).toBeVisible();

        /*
      A document is longer than the panel and the region holds no focusable
      children, so without a tab stop of its own there is nothing for arrow keys
      to act on — a keyboard reader could open a citation and never reach the
      rest of the passage. axe found this one (`scrollable-region-focusable`);
      the test is here so it stays fixed.
    */
        const region = panel.getByRole("region", { name: /source text of/i });
        await expect(region).toBeVisible();
        await expect(region).toHaveAttribute("tabindex", "0");

        await region.focus();
        await expect(region).toBeFocused();
      });
    });
  });
}

test.describe("controls look interactive", () => {
  /**
   * Tailwind v4's Preflight sets `cursor: default` on buttons, matching the
   * browser default where v3 set `cursor: pointer`. Upgrading therefore removed
   * the pointer from every button in the app at once, silently, while links kept
   * theirs — so the app was inconsistent with itself and buttons read as
   * decoration.
   *
   * axe cannot see this: a button with a default cursor is a perfectly valid
   * button. It is the same category as the citation chip drawn in the color of
   * the bubble behind it — present, labeled, operable, not evidently a control.
   */
  test("buttons offer a pointer, and disabled ones do not", async ({
    page,
  }) => {
    await page.goto("/demo");

    const cursorOf = (locator: ReturnType<typeof page.getByRole>) =>
      locator.evaluate((el) => getComputedStyle(el).cursor);

    await expect(
      page.getByRole("button", { name: /leave demo/i }),
    ).toBeVisible();
    expect(
      await cursorOf(page.getByRole("button", { name: /leave demo/i })),
    ).toBe("pointer");

    // Disabled deliberately keeps the default: a pointer on a control that will
    // not respond is a promise the interface does not keep.
    const send = page.getByRole("button", { name: /send/i });
    await expect(send).toBeDisabled();
    expect(await cursorOf(send)).toBe("default");

    await page.goto("/sign-in");
    expect(await cursorOf(page.getByRole("button", { name: /github/i }))).toBe(
      "pointer",
    );
  });
});
