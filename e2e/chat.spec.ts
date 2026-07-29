import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * The milestone's exit criteria, driven through a real browser: ask, watch it
 * stream, click a citation, read the source.
 *
 * Runs against the seeded demo workspace as a guest, with both providers faked.
 * A live model would make "the answer cites [1]" a coin toss rather than an
 * assertion, and CI has no API key in any case.
 */

/** Answered by the seeded handbook. */
const ANSWERABLE = "When is reimbursement paid?";
/** Nothing in the workspace comes close to this. */
const UNANSWERABLE = "Who won the world cup in 1998?";

async function ask(page: Page, question: string) {
  await page.getByRole("textbox", { name: /ask a question/i }).fill(question);
  await page.getByRole("button", { name: /send/i }).click();
}

test.describe("asking a question", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { level: 2, name: /ask/i }),
    ).toBeVisible();
  });

  test("a guest can ask a question and get a cited answer", async ({
    page,
  }) => {
    await ask(page, ANSWERABLE);

    // The question is echoed back before the answer arrives, so the reader can
    // see what was asked while they wait.
    await expect(page.getByText(ANSWERABLE)).toBeVisible();

    // The chip is the whole point: a numbered marker resolved against sources
    // the server sent, naming the document it came from.
    const chip = page.getByRole("button", { name: /^Citation 1:/ });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAccessibleName(/northwind-remote-work-handbook/i);
  });

  test("clicking a citation opens the source at the cited passage", async ({
    page,
  }) => {
    await ask(page, ANSWERABLE);
    await page.getByRole("button", { name: /^Citation 1:/ }).click();

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(
      panel.getByRole("heading", { name: /northwind-remote-work-handbook/i }),
    ).toBeVisible();

    // The invariant, end to end and on screen: the highlighted region is the
    // passage the answer was grounded in, sliced out of the stored document by
    // the offsets recorded at chunking time.
    const highlight = panel.locator("mark");
    await expect(highlight).toBeVisible();
    await expect(highlight).not.toBeEmpty();

    // Surrounding text is present too — a citation you cannot read around is
    // barely a citation.
    await expect(
      panel.getByText(/Northwind Remote Work Handbook/),
    ).toBeVisible();
  });

  test("the source panel leaves the conversation readable behind it", async ({
    page,
  }) => {
    await ask(page, ANSWERABLE);
    await page.getByRole("button", { name: /^Citation 1:/ }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    // Non-modal by design: checking a citation means reading the claim and the
    // passage together.
    await expect(page.getByText(ANSWERABLE)).toBeVisible();
  });

  test("the panel closes with Escape", async ({ page }) => {
    await ask(page, ANSWERABLE);
    await page.getByRole("button", { name: /^Citation 1:/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("when nothing relevant is found", () => {
  test("says so, and cites nothing at all", async ({ page }) => {
    await page.goto("/demo");
    await ask(page, UNANSWERABLE);

    await expect(
      page.getByText(/couldn't find anything relevant/i),
    ).toBeVisible();

    // The guarantee, asserted rather than assumed: an unanswerable question
    // produces no citation chips, because the model was never called and there
    // is nothing for a marker to point at.
    await expect(page.getByRole("button", { name: /^Citation/ })).toHaveCount(
      0,
    );
  });
});

test.describe("keyboard only", () => {
  test("a question can be asked and a citation opened without a mouse", async ({
    page,
  }) => {
    await page.goto("/demo");

    const composer = page.getByRole("textbox", { name: /ask a question/i });
    await composer.focus();
    await composer.type(ANSWERABLE);
    // Enter sends; Shift+Enter would insert a newline.
    await page.keyboard.press("Enter");

    const chip = page.getByRole("button", { name: /^Citation 1:/ });
    await expect(chip).toBeVisible();

    await chip.focus();
    await page.keyboard.press("Enter");

    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    // Focus moves into the panel, or a keyboard user would activate the chip
    // and have nothing happen where their focus is.
    await expect(panel.locator(":focus")).toHaveCount(1);
  });
});

test.describe("guest conversations are not stored", () => {
  test("a reload starts the conversation over", async ({ page }) => {
    await page.goto("/demo");
    await ask(page, ANSWERABLE);
    await expect(page.getByText(ANSWERABLE)).toBeVisible();

    await page.reload();

    // The visible consequence of not writing rows for anonymous visitors, and
    // the reason the demo cannot be used as an unbounded write path.
    await expect(page.getByText(ANSWERABLE)).not.toBeVisible();
    await expect(
      page.getByText(/ask a question about your documents/i).first(),
    ).toBeVisible();
  });
});
