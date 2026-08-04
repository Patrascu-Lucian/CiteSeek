/**
 * Regenerates the README screenshots. By hand (`pnpm demo:shots`), never in CI.
 *
 * **Needs the real providers.** The fake embedder retrieves the wrong passage —
 * tolerable to every E2E assertion, not to a picture of a citation
 * (`docs/code-review-notes.md`). So output is not reproducible and each run
 * spends quota. `SHOTS_BASE_URL` picks the target.
 */
import { chromium, devices, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.SHOTS_BASE_URL ?? "https://citeseek.app";

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "images",
);

// 1×, since four frames at 2× is over a megabyte. 1280 is past the header's `md`
// breakpoint, so the nav is the desktop one rather than the hamburger.
const VIEWPORT = { width: 1280, height: 900 };

/** Answered by the seeded handbook, and phrased the way someone would ask. */
const QUESTION = "What can I claim back for a hotel, and do I need a receipt?";

const THEME_COOKIE = "citeseek_theme";

/** Radix animates the sheet in. A shot taken on `visible` catches it mid-slide,
 * cropped at the frame edge — poll the box until it stops moving instead. */
async function waitUntilStill(page: Page, selector: string) {
  let previous = "";

  for (let attempt = 0; attempt < 20; attempt++) {
    const box = await page.locator(selector).first().boundingBox();
    const current = JSON.stringify(box);

    if (box && current === previous) return;

    previous = current;
    await page.waitForTimeout(100);
  }
}

const browser = await chromium.launch();

try {
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log(`Shooting ${BASE_URL}`);

  /** One pass per theme in its own context: a guest's transcript lives in browser
   * state, so the dark frame cannot be a reload of the light one. */
  const capture = async (theme: "light" | "dark", names: readonly string[]) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      baseURL: BASE_URL,
    });

    // Set before the first navigation: the server reads this cookie and renders
    // the class on the first byte (ADR 018), so a later reload would be a second
    // request rather than a repaint.
    await context.addCookies([
      { name: THEME_COOKIE, value: theme, url: BASE_URL },
    ]);

    const page = await context.newPage();
    const shot = async (name: string) => {
      await page.screenshot({ path: join(OUTPUT_DIR, `${name}.png`) });
      console.log(`  wrote ${name}.png`);
    };

    try {
      if (names.includes("landing")) {
        await page.goto("/");
        await page
          .getByRole("heading", { level: 1 })
          .first()
          .waitFor({ state: "visible" });
        await shot("landing");
      }

      // `/demo` mints the guest cookie and redirects. Going straight to `/w/<id>`
      // would be bounced to sign-in and shoot that instead.
      await page.goto("/demo");
      await page
        .getByText(/northwind-remote-work-handbook\.pdf/i)
        .first()
        .waitFor({ state: "visible", timeout: 30_000 });

      await page
        .getByRole("textbox", { name: /ask a question/i })
        .fill(QUESTION);
      await page.getByRole("button", { name: /send/i }).click();

      // The chip, not the text: an answer citing nothing is a refusal, and
      // failing here is what stops a README image showing the feature not working.
      const chip = page.getByRole("button", { name: /^Citation 1:/ });
      await chip.waitFor({ state: "visible", timeout: 60_000 });

      // The first chip lands while the rest of the answer is still arriving.
      // Stop is rendered only while streaming, so its absence is the end of it —
      // a timeout here would be a guess that gets shorter than the model on a
      // slow day.
      await page
        .getByRole("button", { name: /^stop$/i })
        .waitFor({ state: "hidden", timeout: 60_000 });

      // Sending scrolls the composer into view, which puts the header off-frame.
      // The header is half of what these shots are showing.
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });

      if (names.includes("answer")) await shot("answer");

      await chip.click();

      const panel = page.getByRole("region", { name: /source text of/i });
      await panel.waitFor({ state: "visible" });
      await waitUntilStill(page, "[role='dialog']");

      // Shown when the stored quote no longer matches the live document. True and
      // useful, and not what a reader should meet first in a README.
      if (
        await page
          .getByText(/has changed since the answer was written/i)
          .isVisible()
      ) {
        throw new Error(
          "The source panel is showing its document-changed warning — the fixture " +
            "and the stored citations disagree. Reseed the demo before shooting.",
        );
      }

      if (names.includes("source")) await shot("source");
      if (names.includes("dark")) await shot("dark");
    } finally {
      await context.close();
    }
  };

  await capture("light", ["landing", "answer", "source"]);
  await capture("dark", ["dark"]);

  console.log(`\nFour shots in ${OUTPUT_DIR}. Open them — a wrong crop or a`);
  console.log("half-written sentence is not something any assertion reports.");
} finally {
  await browser.close();
}
