import { join } from "node:path";

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * The browser half of extraction, which Node cannot prove: unit tests always
 * resolve mammoth's Node build.
 */

const FIXTURES = join(import.meta.dirname, "..", "lib", "rag", "__fixtures__");

/** Otherwise every upload pulls a 30 MB model, on a runner that may have no
 * Hugging Face access at all. */
const stubEmbedder = (page: Page) =>
  page.addInitScript(() => {
    (
      globalThis as { __citeseekLocalEmbedder?: string }
    ).__citeseekLocalEmbedder = "fake";
  });

const uploadPanel = (page: Page) =>
  page.getByRole("region", { name: /add a document/i });

const storagePanel = (page: Page) =>
  page.getByRole("region", { name: /stored on this machine/i });

async function upload(page: Page, name: string) {
  await stubEmbedder(page);
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
      /indexed \d+ passages?/i,
    );
    // The name is the storage list's to give: saying it here too put the same
    // file on screen twice.
    await expect(storagePanel(page).getByText("sample.pdf")).toBeVisible();
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
      /indexed \d+ passages?/i,
    );
    await expect(storagePanel(page).getByText("sample.docx")).toBeVisible();
  });

  test("indexes the passages, not only the text", async ({ page }) => {
    await upload(page, "sample.md");

    await expect(uploadPanel(page).getByRole("status")).toContainText(
      /indexed \d+ passages? on this machine/i,
    );
  });

  test("marks the document ready once every passage has a vector", async ({
    page,
  }) => {
    // `processing` until the vectors land is the same order the server uses, and
    // the state a half-embedded document must not leave.
    await upload(page, "sample.pdf");
    await expect(uploadPanel(page).getByRole("status")).toContainText(
      /indexed \d+ passages? on this machine/i,
    );

    const stored = await page.evaluate(
      () =>
        new Promise<{ status: string; embedded: number; total: number }>(
          (resolve, reject) => {
            const open = indexedDB.open("citeseek-local");
            open.onerror = () => reject(new Error("could not open"));
            open.onsuccess = () => {
              const db = open.result;
              const tx = db.transaction(["documents", "chunks"], "readonly");
              const docs = tx.objectStore("documents").getAll() as IDBRequest<
                { status: string }[]
              >;
              const chunks = tx.objectStore("chunks").getAll() as IDBRequest<
                { embedding: number[] | null }[]
              >;
              tx.oncomplete = () => {
                db.close();
                resolve({
                  status: docs.result[0]!.status,
                  embedded: chunks.result.filter((c) => c.embedding !== null)
                    .length,
                  total: chunks.result.length,
                });
              };
              tx.onerror = () => reject(new Error("transaction failed"));
            };
          },
        ),
    );

    expect(stored.status).toBe("ready");
    expect(stored.embedded).toBe(stored.total);
    expect(stored.total).toBeGreaterThan(0);
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
    await stubEmbedder(page);
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

test.describe("the vendored ONNX runtime", () => {
  test("is served from this origin, not fetched from a CDN", async ({
    request,
  }) => {
    /*
      The stub replaces the embedder in every other spec here, so nothing else
      would notice if `public/onnx` were empty — an upstream rename, a miss in
      `copy-onnx-runtime.mts`, or the CI artifact not carrying it. Since
      `connect-src` no longer allows jsDelivr, that failure is local mode broken
      in production with a green suite. ADR 032.
    */
    const response = await request.get(
      "/onnx/ort-wasm-simd-threaded.asyncify.wasm",
    );

    expect(response.status()).toBe(200);
    // The body, not `content-length`: the response is chunked and carries none.
    expect((await response.body()).byteLength).toBeGreaterThan(1_000_000);
  });
});

test("says nothing about a model provider, because nothing reaches one", async ({
  page,
}) => {
  await stubEmbedder(page);
  await page.goto("/local");

  // The dropzone is shared with the workspace, which does send files onward.
  await expect(
    page.getByRole("button", { name: /drop files here/i }),
  ).toBeVisible();
  await expect(page.getByText(/gemini/i)).toHaveCount(0);
});
