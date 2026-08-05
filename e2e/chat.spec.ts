import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { DEMO_EXAMPLE_QUESTIONS } from "../lib/demo/example-questions";

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

  /**
   * The question this slice exists for.
   *
   * "How do I upload a file?" is a reasonable thing to type into a chat box and
   * it is refused, because the answer is not in anyone's documents. The refusal
   * was correct and useless. What makes it useful is naming what *can* be
   * answered and pointing at the interface — none of it written by a model.
   */
  test("a question about the product says what the documents do cover", async ({
    page,
  }) => {
    await page.goto("/demo");
    await ask(page, "How do I upload a file?");

    const refusal = page.locator("[data-refusal]");
    await expect(refusal).toBeVisible();

    // Named, so the reader learns the boundary rather than guessing at it.
    await expect(refusal).toContainText(/northwind-remote-work-handbook/i);
    await expect(refusal).toContainText(/no knowledge outside them/i);

    // A guest cannot upload here, so they are offered the thing that would let
    // them — never an instruction they are unable to follow.
    await expect(refusal.getByRole("link", { name: /sign in/i })).toBeVisible();

    // The failure this whole design prevents: a refusal that cites.
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
    await composer.fill(ANSWERABLE);
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
      page.getByText(/ask a question about the handbook/i).first(),
    ).toBeVisible();
  });
});

test.describe("when capacity runs out", () => {
  /**
   * The refusal is injected at the network boundary rather than by actually
   * exhausting a quota. The thresholds are covered by integration tests; what
   * cannot be covered there is what a reader sees and what they can do next,
   * which needs a real browser.
   *
   * This suite runs with `USAGE_LIMITS=off`, so nothing here can trip a genuine
   * cap — the interception is the only source of a 429.
   */
  async function refuseWith(page: Page, code: string) {
    await page.route("**/api/w/*/chat", (route) =>
      route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "…", code }),
      }),
    );
  }

  test("a guest is told the demo is full, and offered a way forward", async ({
    page,
  }) => {
    await page.goto("/demo");
    await refuseWith(page, "capacity_reached");
    await ask(page, ANSWERABLE);

    // Scoped to the chat section: Next injects its own route announcer as a
    // `role="alert"` element, so an unscoped query matches two things.
    const alert = page.getByRole("region", { name: /ask/i }).getByRole("alert");
    await expect(alert).toContainText(/today's capacity/i);

    // No retry, because retrying a daily cap cannot work. Signing in can:
    // the global cap reserves headroom below the guest ceiling.
    await expect(
      alert.getByRole("button", { name: /try again|retry/i }),
    ).toHaveCount(0);
    await expect(alert.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("a burst offers a retry instead", async ({ page }) => {
    await page.goto("/demo");
    await refuseWith(page, "rate_limited");
    await ask(page, ANSWERABLE);

    const alert = page.getByRole("region", { name: /ask/i }).getByRole("alert");
    await expect(alert).toContainText(/wait a moment/i);
    await expect(
      alert.getByRole("button", { name: /try again/i }),
    ).toBeVisible();
  });
});

test.describe("usage", () => {
  test("a workspace reports what it has spent, in tokens", async ({ page }) => {
    await page.goto("/demo");
    // Reached from the header now rather than the workspace body: a page nobody
    // can find is a page nobody reads.
    await page.getByRole("link", { name: /^usage$/i }).click();

    await expect(page).toHaveURL(/\/usage$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /usage/i }),
    ).toBeVisible();

    // The window is the retention bound, and the page has to say so — otherwise
    // a pruned month reads as a quiet one.
    await expect(page.getByText(/last 30 days/i)).toBeVisible();

    // Never a currency figure: the free tier costs nothing, so any money here
    // would describe a tier this app is not on.
    await expect(page.locator("main")).not.toContainText("$");
  });

  test("the demo says nothing a guest does is charged to it", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page.goto(page.url().replace(/\/?$/, "/usage"));

    // Wait for the loading boundary to hand over. Until it does there are two
    // `<main>` elements on the page — the skeleton and the content — which is
    // transient but makes any `main` locator ambiguous.
    await expect(
      page.getByRole("heading", { level: 1, name: /usage/i }),
    ).toBeVisible();
    await expect(page.locator("[aria-busy='true']")).toHaveCount(0);

    // The demo is read-only for everyone, so the empty state must not tell a
    // guest to upload something in order to generate usage.
    await expect(page.locator("main")).not.toContainText(
      /uploading a document/i,
    );
  });
});

test.describe("the composer", () => {
  test("grows with a long question and stops before it takes the panel", async ({
    page,
  }) => {
    // Narrow, because a long question still fits two lines on a desktop width —
    // measured, and the reason an earlier version of this test proved nothing.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/demo");

    const box = page.getByRole("textbox", { name: /ask a question/i });
    const height = () =>
      box.evaluate((el) => Math.round(el.getBoundingClientRect().height));

    const initial = await height();

    await box.fill(
      "What can I claim back for a hotel in London, and do I need to keep a receipt for every single expense?",
    );
    const grown = await height();
    expect(grown).toBeGreaterThan(initial);

    // Capped rather than unbounded, and scrolling past the cap rather than
    // clipping — a composer that eats the panel leaves nowhere to read the answer.
    await box.fill(
      "Please explain the whole reimbursement policy. ".repeat(20),
    );
    const capped = await height();
    expect(capped).toBeLessThanOrEqual(160);
    expect(
      await box.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
    ).toBe(true);

    // Back to where it started once the question is sent.
    await box.fill("When is reimbursement paid?");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(box).toHaveValue("");
    expect(await height()).toBe(initial);
  });
});

test.describe("starting from nothing", () => {
  /*
    The first cold reader stopped here: an empty composer over a shared handbook
    she had no way to read, with nothing suggesting what it could answer. ADR 022.
  */
  test("the demo offers a question, and clicking it asks that question", async ({
    page,
  }) => {
    await page.goto("/demo");

    const starter = page.getByRole("button", {
      name: DEMO_EXAMPLE_QUESTIONS[0],
    });
    await expect(starter).toBeVisible();
    await starter.click();

    await expect(
      page.getByText(DEMO_EXAMPLE_QUESTIONS[0], { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Citation 1/ })).toBeVisible(
      {
        timeout: 15_000,
      },
    );
  });

  test("does not tell a guest the shared documents are theirs", async ({
    page,
  }) => {
    await page.goto("/demo");

    await expect(page.getByText(/your documents/i)).toHaveCount(0);
  });
});
