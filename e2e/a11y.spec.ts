import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * **axe is a floor, not the pass.** A citation chip here once rendered in exactly
 * the color of the bubble behind it — labeled, operable, invisible — and every
 * automated check passed, contrast included, because those compare text to its
 * own background. What failed was affordance, which nothing automated measures.
 *
 * So this catches the mechanical failures; the keyboard specs below cover the rest.
 */

/**
 * WCAG 2.2 AA, the bar the project claims. `best-practice` is excluded: it mixes
 * real issues with opinion, and a suite that fails on an opinion gets ignored.
 */
const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Reduced to the rule id, impact and markup: a raw `toEqual([])` prints hundreds
 * of lines and buries the one sentence saying what is wrong. */
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

/** `proxy.ts` redirects a credential-less `/w/*` to `/sign-in`, so scanning that
 * URL would report a clean sign-in page. `/demo` mints the cookie first. */
async function gotoDemo(page: Page) {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { level: 2, name: /ask/i }),
  ).toBeVisible();
}

/**
 * Both palettes over the same specs, not a second copy: a contrast pair fine in
 * one can fail in the other, and duplicated specs drift the first time someone
 * updates only the copy in front of them.
 */
/**
 * Contrast of an element's text against its own background, both painted onto a
 * canvas first. `getComputedStyle` returns `lab()` and `oklab()` here, and
 * reading those numbers as RGB reports 1:1 for every pair; painting also
 * composites the `/20` tints that several surfaces are built from.
 */
async function contrastOf(locator: Locator): Promise<number> {
  const { fg, bg } = await locator.evaluate((node) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const paint = (color: string, under: string) => {
      ctx.fillStyle = under;
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };

    let behind = "rgb(255,255,255)";
    for (let el = node.parentElement; el; el = el.parentElement) {
      const color = getComputedStyle(el).backgroundColor;
      if (color && color !== "rgba(0, 0, 0, 0)") {
        behind = color;
        break;
      }
    }

    const style = getComputedStyle(node);
    const own = style.backgroundColor;
    return {
      bg: paint(own, behind),
      fg: paint(style.color, own === "rgba(0, 0, 0, 0)" ? behind : own),
    };
  });

  const luminance = (rgb: number[]) => {
    const channel = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return (
      0.2126 * channel(rgb[0]!) +
      0.7152 * channel(rgb[1]!) +
      0.0722 * channel(rgb[2]!)
    );
  };

  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

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
      // Guards the parameterization itself: a cookie the server ignored would
      // run every check below against the light palette twice.
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

      test("the about, privacy and terms pages", async ({ page }) => {
        // Long prose pages, which is where heading order and link contrast go
        // wrong quietly.
        await page.goto("/about");
        expect(await violationsOn(page)).toEqual([]);

        await page.goto("/privacy");
        expect(await violationsOn(page)).toEqual([]);

        await page.goto("/terms");
        expect(await violationsOn(page)).toEqual([]);
      });

      test("the 404", async ({ page }) => {
        await page.goto("/no-such-page");

        expect(await violationsOn(page)).toEqual([]);
      });

      /** A second copy of the navigation, so a second chance at a duplicate
       * landmark — the header row already owns a `nav` named "Main". */
      test("the navigation menu on a small screen, open", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoDemo(page);

        await page.getByRole("button", { name: /menu/i }).click();
        await expect(page.getByRole("dialog")).toBeVisible();

        expect(await violationsOn(page)).toEqual([]);
      });
    });

    /** Each of these is a way the automated pass gives a false negative: a rule
     * satisfied while the experience is broken. */
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
      The chip was `bg-muted` on a `bg-muted` bubble: drawn every time, in exactly
      the color behind it. axe passed and would again — its contrast rules compare
      *text* to its own background. So this compares the two backgrounds.
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

      test("the ready badge stays legible against its own tint", async ({
        page,
      }) => {
        /*
          The badge is `text-success` on `bg-success/10`, so its background is a
          composite the stylesheet never names — axe reads the declared color and
          the declared background, not what the two produce together. The light
          green that looked right first measured 4.53:1, which is AA by 0.03.
        */
        await gotoDemo(page);
        // The badge, not its text: below `sm` the word is an `sr-only` span — a
        // clipped 1px box with no background, which measures 1:1 either way.
        const badge = page.locator('[data-slot="badge"]').first();
        await expect(badge).toBeVisible();

        const ratio = await badge.evaluate((node) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d")!;

          // Painted rather than parsed: `getComputedStyle` returns `lab()` and
          // `oklab()` here, and reading those numbers as RGB reports 1:1 for
          // every pair.
          const paint = (color: string, under: string) => {
            ctx.fillStyle = under;
            ctx.fillRect(0, 0, 1, 1);
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
          };

          let behind = "rgb(255,255,255)";
          for (let el = node.parentElement; el; el = el.parentElement) {
            const bg = getComputedStyle(el).backgroundColor;
            if (bg && bg !== "rgba(0, 0, 0, 0)") {
              behind = bg;
              break;
            }
          }

          const style = getComputedStyle(node);
          const background = paint(style.backgroundColor, behind);
          const text = paint(style.color, style.backgroundColor);

          const luminance = (rgb: number[]) => {
            const channel = (v: number) => {
              const c = v / 255;
              return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            return (
              0.2126 * channel(rgb[0]!) +
              0.7152 * channel(rgb[1]!) +
              0.0722 * channel(rgb[2]!)
            );
          };

          const [hi, lo] = [luminance(text), luminance(background)].sort(
            (a, b) => b - a,
          );
          return (hi! + 0.05) / (lo! + 0.05);
        });

        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      test("the accent carries the citation without losing its text", async ({
        page,
      }) => {
        /*
          `--primary` is the brand accent and it paints the two things the product
          is about: the pressed chip and the passage it highlights. The highlight
          is `bg-primary/20`, a tint over the page that the stylesheet never names,
          so axe cannot see the pair it actually produces.
        */
        await gotoDemo(page);
        await page
          .getByRole("textbox", { name: /ask a question/i })
          .fill("When is reimbursement paid?");
        await page.getByRole("button", { name: /send/i }).click();

        const chip = page.getByRole("button", { name: /^Citation 1:/ });
        await expect(chip).toBeVisible();
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "true");

        const mark = page.getByRole("dialog").locator("mark");
        await expect(mark).toBeVisible();

        // `transition-colors` on the chip: sampling the instant `aria-pressed`
        // flips reads the color the animation started from, which is the
        // unpressed one, and reports a passing ratio for the wrong state.
        await expect
          .poll(async () => contrastOf(chip), { timeout: 5_000 })
          .toBeGreaterThanOrEqual(4.5);

        expect(await contrastOf(mark)).toBeGreaterThanOrEqual(4.5);
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

        // The region scrolls and holds no focusable children, so without a tab
        // stop arrow keys have nothing to act on. axe found it
        // (`scrollable-region-focusable`); this keeps it fixed.
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
   * Tailwind v4's Preflight sets `cursor: default` on buttons where v3 set
   * `pointer`, so upgrading silently removed it from every button while links
   * kept theirs. axe cannot see it: a default cursor is a valid button.
   */
  test("buttons offer a pointer, and disabled ones do not", async ({
    page,
  }) => {
    await page.goto("/demo");

    const cursorOf = (locator: ReturnType<typeof page.getByRole>) =>
      locator.evaluate((el) => getComputedStyle(el).cursor);

    await expect(
      page.getByRole("link", { name: /^sign in$/i }).first(),
    ).toBeVisible();
    expect(
      await cursorOf(page.getByRole("link", { name: /^sign in$/i }).first()),
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

test.describe("the document row says it opens something", () => {
  // axe cannot catch this: a button that looks like a paragraph is a valid
  // button, and the row's only signals used to be `hover:`.
  test("an openable document carries an icon; one still processing does not", async ({
    page,
  }) => {
    await page.goto("/demo");

    const name = page.getByRole("button", {
      name: "northwind-remote-work-handbook.pdf",
      exact: true,
    });
    await expect(name).toBeVisible();

    await expect(name.locator("svg")).toBeVisible();

    // `exact` above is the other half: the icon is decorative, so it must add
    // nothing to the name.
  });
});

test.describe("layout at phone widths", () => {
  /*
    Making the filename a button broke its truncation: a button is inline-block,
    so it sizes to its text and `truncate` never fires
  */
  test("the ready badge narrows to a glyph but still says its word", async ({
    page,
  }) => {
    const badge = page.locator('[data-slot="badge"]').first();

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/demo");
    await expect(badge).toBeVisible();
    const narrow = (await badge.boundingBox())!.width;

    await expect(badge).toHaveText(/Ready/);

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(badge).toHaveText(/Ready/);
    await expect(badge).toBeVisible();

    expect(narrow).toBeLessThan((await badge.boundingBox())!.width);
  });

  test("a long filename truncates rather than running under the badge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/demo");

    const row = page.locator("li").filter({ hasText: "northwind" }).first();
    const name = page.getByRole("button", {
      name: /northwind-remote-work-handbook\.pdf/,
    });
    await expect(name).toBeVisible();

    const rowBox = (await row.boundingBox())!;
    const nameBox = (await name.boundingBox())!;
    const badgeBox = (await page
      .getByText("Ready", { exact: true })
      .boundingBox())!;

    // Rectangles, not "the badge is to the right": the badge wraps to its own
    // line at this width, so a horizontal-only check would pass on any layout
    // once they stopped sharing a line.
    const overlaps =
      nameBox.x < badgeBox.x + badgeBox.width &&
      badgeBox.x < nameBox.x + nameBox.width &&
      nameBox.y < badgeBox.y + badgeBox.height &&
      badgeBox.y < nameBox.y + nameBox.height;

    expect(overlaps).toBe(false);
    expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(
      rowBox.x + rowBox.width,
    );

    // The point of the reflow: the name gets the line, not a sliver of it.
    expect(nameBox.width).toBeGreaterThan(240);
  });
});
