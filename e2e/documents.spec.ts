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

test("a delete that never reaches the server keeps the document, and says so", async ({
  page,
  signedIn,
}) => {
  await signedIn.sql`
    insert into documents (workspace_id, filename, mime_type, size_bytes, status, content_text, chunk_count)
    values (${signedIn.workspaceId}, 'handbook.pdf', 'application/pdf', 2048, 'ready', 'Grounded.', 1)`;
  await page.route("**/api/w/*/documents/*", (route) =>
    route.request().method() === "DELETE" ? route.abort() : route.continue(),
  );

  await page.goto(`/w/${signedIn.workspaceId}`);
  await hydrated(page, UPLOAD_INPUT);
  await page.getByRole("button", { name: "Delete handbook.pdf" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete" })
    .click();

  await expect(
    page.getByText("Could not reach the server, so nothing was deleted."),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "handbook.pdf" }),
  ).toBeVisible();
  expect(await violationsOn(page)).toEqual([]);
});
