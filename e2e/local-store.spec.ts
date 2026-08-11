import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * `fake-indexeddb` covers the store's behavior in milliseconds. What it cannot
 * cover is the real engine, and the claim on the privacy page is about a real
 * browser: that deleting everything leaves nothing recoverable in it.
 */

const DATABASE = "citeseek-local";

/** The page's own read is what creates the database and its object stores, so
 * seeding before it lands would open a version with no stores to write to. */
async function gotoLocal(page: Page) {
  await page.goto("/local");
  await expect(storagePanel(page)).toBeVisible();
}

const storagePanel = (page: Page) =>
  page.getByRole("region", { name: /stored on this machine/i });

/** Writes directly, because ingestion does not exist yet — the deletion path is
 * what this spec is about, and it needs something to delete. */
async function seed(page: Page, documents: number) {
  await page.evaluate(
    ({ name, count }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name);

        open.onerror = () =>
          reject(open.error ?? new Error("Could not open the local database."));
        open.onsuccess = () => {
          const db = open.result;
          const transaction = db.transaction(
            ["documents", "chunks"],
            "readwrite",
          );

          for (let index = 0; index < count; index += 1) {
            transaction.objectStore("documents").put({
              id: `doc-${index}`,
              filename: `seeded-${index}.pdf`,
              mimeType: "application/pdf",
              sizeBytes: 10,
              status: "ready",
              error: null,
              pageCount: 1,
              chunkCount: 1,
              embeddingDimensions: 384,
              createdAt: index,
              updatedAt: index,
            });
            transaction.objectStore("chunks").put({
              id: `chunk-${index}`,
              documentId: `doc-${index}`,
              index: 0,
              text: "Reimbursement is paid within 30 days.",
              page: 1,
              startOffset: 0,
              endOffset: 37,
              embedding: Array<number>(384).fill(0.1),
            });
          }

          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () =>
            reject(
              transaction.error ?? new Error("The local transaction failed."),
            );
        };
      }),
    { name: DATABASE, count: documents },
  );
}

async function storedRecords(page: Page) {
  return page.evaluate(
    (name) =>
      new Promise<{ documents: number; chunks: number; text: string[] }>(
        (resolve, reject) => {
          const open = indexedDB.open(name);

          open.onerror = () =>
            reject(
              open.error ?? new Error("Could not open the local database."),
            );
          open.onsuccess = () => {
            const db = open.result;
            const transaction = db.transaction(
              ["documents", "chunks"],
              "readonly",
            );
            const documents = transaction.objectStore("documents").count();
            const chunks = transaction
              .objectStore("chunks")
              .getAll() as IDBRequest<{ text: string }[]>;

            transaction.oncomplete = () => {
              db.close();
              resolve({
                documents: documents.result,
                chunks: chunks.result.length,
                // The text itself, not a count: "the list looks empty" and
                // "the passage is gone" are different claims.
                text: chunks.result.map((chunk) => chunk.text),
              });
            };
            transaction.onerror = () =>
              reject(
                transaction.error ?? new Error("The local transaction failed."),
              );
          };
        },
      ),
    DATABASE,
  );
}

test.describe("local mode storage", () => {
  test("reports what this browser is holding", async ({ page }) => {
    await gotoLocal(page);
    await seed(page, 2);
    await page.reload();

    await expect(storagePanel(page).getByRole("status")).toContainText(
      "2 documents and 2 passages",
    );
  });

  test("deleting everything leaves nothing recoverable", async ({ page }) => {
    await gotoLocal(page);
    await seed(page, 2);
    await page.reload();

    await storagePanel(page)
      .getByRole("button", { name: "Delete everything" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("2 documents and 2 passages");
    await dialog.getByRole("button", { name: "Delete everything" }).click();

    await expect(storagePanel(page).getByRole("status")).toContainText(
      /nothing from local mode remains/i,
    );

    // Read back out of IndexedDB rather than off the screen: the promise is that
    // the data is gone, and a component can report an empty store either way.
    expect(await storedRecords(page)).toEqual({
      documents: 0,
      chunks: 0,
      text: [],
    });
  });

  test("survives a reload, which is what 'kept in this browser' means", async ({
    page,
  }) => {
    await gotoLocal(page);
    await seed(page, 1);
    await page.reload();

    await expect(storagePanel(page).getByRole("status")).toContainText(
      "1 document and 1 passage",
    );
  });

  test("offers nothing to delete on a browser holding nothing", async ({
    page,
  }) => {
    await gotoLocal(page);

    await expect(
      storagePanel(page).getByRole("button", { name: "Delete everything" }),
    ).toBeDisabled();
    await expect(storagePanel(page).getByRole("status")).toContainText(
      /nothing yet/i,
    );
  });
});
