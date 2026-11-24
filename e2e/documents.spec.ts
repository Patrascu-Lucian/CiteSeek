import { join } from "node:path";

import { violationsOn } from "./axe";
import { hydrated } from "./hydration";
import { expect, test } from "./signed-in";

const UPLOAD_INPUT = 'input[type="file"]';
const FIXTURES = join(import.meta.dirname, "..", "lib", "rag", "__fixtures__");

test("a PDF with no text says it needs OCR, and offers no retry", async ({
  page,
  signedIn,
}) => {
  await page.goto(`/w/${signedIn.workspaceId}`);
  await hydrated(page, UPLOAD_INPUT);
  await page.locator(UPLOAD_INPUT).setInputFiles(join(FIXTURES, "blank.pdf"));

  const row = page.getByRole("listitem").filter({ hasText: "blank.pdf" });
  // Ingestion runs after the upload's response, and the list polls every 2 s.
  await expect(
    row.getByText(/no text could be read from this file/i),
  ).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText("Failed")).toBeVisible();
  await expect(row.getByRole("button", { name: /retry/i })).toHaveCount(0);
  expect(await violationsOn(page)).toEqual([]);
});
