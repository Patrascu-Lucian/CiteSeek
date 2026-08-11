import { join } from "node:path";

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * The browser half of extraction, which Node cannot prove: unit tests always
 * resolve mammoth's Node build.
 */

const FIXTURES = join(import.meta.dirname, "..", "lib", "rag", "__fixtures__");

const uploadPanel = (page: Page) =>
  page.getByRole("region", { name: /add a document/i });

const storagePanel = (page: Page) =>
  page.getByRole("region", { name: /stored on this machine/i });

async function upload(page: Page, name: string) {
  await page.goto("/local");
  await expect(uploadPanel(page)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(join(FIXTURES, name));
}

test.describe("local ingestion", () => {
  test("parses a PDF in the browser and stores its passages", async ({
    page,
  }) => {
    await upload(page, "sample.pdf");

    await expect(uploadPanel(page).getByRole("status")).toContainText(
      /sample\.pdf — \d+ passages?/,
    );
    await expect(storagePanel(page).getByRole("status")).toContainText(
      /1 document and \d+ passages?/,
    );
  });

  test("parses a Word document, which is what the Buffer fix was for", async ({
    page,
  }) => {
    // `Buffer.from` here threw `Buffer is not defined` in a worker, and the
    // obvious fix — sending `arrayBuffer` — breaks the server instead.
    await upload(page, "sample.docx");

    await expect(uploadPanel(page).getByRole("status")).toContainText(
      /sample\.docx — \d+ passages?/,
    );
  });

  test("says a passage is not searchable yet, rather than implying it is", async ({
    page,
  }) => {
    await upload(page, "sample.md");

    await expect(uploadPanel(page).getByRole("status")).toContainText(
      /not searchable yet/i,
    );
  });

  test("keeps the parsed text in this browser across a reload", async ({
    page,
  }) => {
    await upload(page, "sample.pdf");
    await expect(storagePanel(page).getByRole("status")).toContainText(
      "1 document",
    );

    await page.reload();

    await expect(storagePanel(page).getByRole("status")).toContainText(
      "1 document",
    );
  });

  test("reports an unreadable file instead of storing an empty document", async ({
    page,
  }) => {
    await page.goto("/local");
    await expect(uploadPanel(page)).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: "broken.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 then garbage"),
    });

    await expect(uploadPanel(page).getByRole("alert")).toBeVisible();
    await expect(storagePanel(page).getByRole("status")).toContainText(
      /nothing yet/i,
    );
  });
});
