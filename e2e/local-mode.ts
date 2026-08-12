import { join } from "node:path";

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Driving `/local` from a runner that has neither a GPU nor any business
 * downloading 884 MB of weights. Shared so the accessibility sweep can reach the
 * answering state without a second copy of the upload flow.
 */

const FIXTURES = join(import.meta.dirname, "..", "lib", "rag", "__fixtures__");

/** Granting the adapter alone, which is the state that offers the download
 * rather than skipping it — the gate is what a first-time reader meets. */
export const stubWebGpu = (page: Page) =>
  page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      value: { requestAdapter: () => Promise.resolve({}) },
    });
  });

/** The adapter *and* the model flag, which swaps the embedder and the generator
 * for deterministic stand-ins and so skips the gate entirely. */
export const stubLocalModels = (page: Page) =>
  page.addInitScript(() => {
    (
      globalThis as { __citeseekLocalEmbedder?: string }
    ).__citeseekLocalEmbedder = "fake";

    Object.defineProperty(navigator, "gpu", {
      value: { requestAdapter: () => Promise.resolve({}) },
    });
  });

export async function uploadAndAsk(page: Page, question: string) {
  await stubLocalModels(page);
  await page.goto("/local");

  await page
    .locator('input[type="file"]')
    .setInputFiles(join(FIXTURES, "sample.md"));
  await expect(
    page.getByRole("region", { name: /add a document/i }).getByRole("status"),
  ).toContainText(/indexed on this machine/i, { timeout: 30_000 });

  await page.getByRole("textbox", { name: /ask a question/i }).fill(question);
  await page.getByRole("button", { name: /send/i }).click();
}
