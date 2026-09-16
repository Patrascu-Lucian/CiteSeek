import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** The demo, because the composer is one component shared by it, the workspace
 * and local mode. */
test.beforeEach(async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("textbox", { name: /ask a question/i }).waitFor();
});

test("opens at one row and grows with the question", async ({ page }) => {
  const field = page.getByRole("textbox", { name: /ask a question/i });

  const opened = (await field.boundingBox())!.height;
  await field.fill("one\ntwo\nthree");
  const grown = (await field.boundingBox())!.height;

  // A second row's worth, so "one row" is a measurement rather than an attribute.
  expect(grown).toBeGreaterThan(opened * 2);
  expect(opened).toBeLessThan(36);
});

test("rounds the send control like the box it sits in", async ({ page }) => {
  // The className is the whole of it: dropping it leaves the Button base's
  // `rounded-lg`, rounder than its container, which no other test here would
  // notice and a diff would not show.
  const send = page.getByRole("button", { name: /send the question/i });

  const [button, box] = await send.evaluate((el) => [
    getComputedStyle(el).borderRadius,
    getComputedStyle(el.parentElement!).borderRadius,
  ]);

  expect(button).toBe(box);
});

test("keeps the send control inside the field, and a real target", async ({
  page,
}) => {
  const field = page.getByRole("textbox", { name: /ask a question/i });
  const send = page.getByRole("button", { name: /send the question/i });

  const box = (await send.boundingBox())!;
  expect(box.width).toBe(box.height);
  expect(box.width).toBeGreaterThanOrEqual(24);

  /* Offsets from the field, not page coordinates: `fill` scrolls the field into
     view, so a `y` taken before it is not in the same layout as one taken after. */
  const offset = async () => {
    const [f, s] = [await field.boundingBox(), await send.boundingBox()];
    return {
      top: s!.y - f!.y,
      bottomGap: f!.y + f!.height - (s!.y + s!.height),
    };
  };

  // Beside a one-line question, bottom edges aligned; below a wrapped one, in
  // its own row under the field rather than biting a corner out of it.
  const beside = await offset();
  expect(beside.bottomGap).toBeCloseTo(0, 0);

  await field.fill("one\ntwo\nthree");
  const under = await offset();

  expect(under.top).toBeGreaterThan(beside.top);
  expect(under.bottomGap).toBeLessThan(0);
});

test("keeps the control row below the field until the draft is sent", async ({
  page,
}) => {
  const field = page.getByRole("textbox", { name: /ask a question/i });
  const row = page.locator("[data-stacked]");

  await expect(row).toHaveCount(0);
  await field.fill("one\ntwo\nthree");
  await expect(row).toHaveCount(1);

  // Back up when the rows go, not only when the field is emptied.
  await field.fill("one");
  await expect(row).toHaveCount(0);

  await field.fill("one\ntwo");
  await expect(row).toHaveCount(1);
  await field.fill("");
  await expect(row).toHaveCount(0);
});

test("stays down while a question is typed at the width that wraps", async ({
  page,
}) => {
  /* The length that wraps beside the button but not underneath it depends on
     the panel, so it is found here rather than written down, and the flicker
     only shows on the keystroke after stacking. jsdom lays nothing out, so no
     unit test can see this. */
  const field = page.getByRole("textbox", { name: /ask a question/i });
  const row = page.locator("[data-stacked]");

  const straddles = await field.evaluate((element: HTMLTextAreaElement) => {
    const style = getComputedStyle(element);
    const lineHeight = parseFloat(style.lineHeight);
    const padding =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const parent = element.parentElement!;
    const send = parent.querySelector("button")!;
    const gap = parseFloat(getComputedStyle(parent).columnGap);

    // The field is inline right now, so this is the width beside the button.
    const beside = element.clientWidth;
    const underneath = beside + send.offsetWidth + gap;

    /* `flex: none` because the field is a flex item: while it sits beside the
       button, `flex-1` sizes it and an explicit width is ignored. */
    const rowsAt = (width: number) => {
      element.style.flex = "none";
      element.style.width = `${width}px`;
      element.style.height = "auto";
      const content = element.scrollHeight;
      element.style.flex = "";
      element.style.width = "";
      element.style.height = "";
      return (content - padding) / lineHeight;
    };

    try {
      /* One-character tokens, because the window between the two widths is the
         button and the gap — 40px — and whole words step over it. */
      for (let tokens = 2; tokens < 600; tokens += 1) {
        element.value = Array.from({ length: tokens }, () => "a").join(" ");
        if (rowsAt(underneath) <= 1.5 && rowsAt(beside) > 1.5) {
          return element.value;
        }
      }
      return null;
    } finally {
      element.value = "";
    }
  });

  expect(
    straddles,
    "no question length wraps beside the button only",
  ).not.toBeNull();

  await field.fill(straddles!);
  await expect(row).toHaveCount(1);

  await field.press("End");
  await field.pressSequentially("s");

  await expect(row).toHaveCount(1);
});

test("has no violation where the label is now the only name", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .include("form:has(#chat-question)")
    .analyze();

  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});
