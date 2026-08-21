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

  // Beside a one-line question; under a grown one, bottom edges aligned.
  const beside = await offset();
  await field.fill("one\ntwo\nthree");
  const under = await offset();

  expect(under.top).toBeGreaterThan(beside.top);
  expect(under.bottomGap).toBeCloseTo(0, 0);
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
