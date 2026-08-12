import { expect, test } from "@playwright/test";

import { uploadAndAsk } from "./local-mode";

/**
 * The milestone's acceptance criterion: **the same citation path**. A local
 * answer has to cite, and the chip has to open the passage it cites — resolved
 * from IndexedDB rather than a route, by the identical offsets the cloud path
 * uses.
 */

test.describe("answering locally", () => {
  test("cites the passage it answered from", async ({ page }) => {
    await uploadAndAsk(page, "Markdown has no pages either");

    await expect(
      page.getByRole("button", { name: /citation 1/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("opens the cited passage from IndexedDB, not a route", async ({
    page,
  }) => {
    // The panel fetches by workspace id in cloud mode. Local mode has no route
    // to call, so this proves the injected loader reads the stored text.
    const documentRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/w/"))
        documentRequests.push(request.url());
    });

    await uploadAndAsk(page, "Markdown has no pages either");
    await page
      .getByRole("button", { name: /citation 1/i })
      .first()
      .click({ timeout: 30_000 });

    await expect(page.getByRole("dialog")).toContainText(/Markdown has no/i);
    expect(documentRequests).toEqual([]);
  });

  test("refuses a question the document cannot answer, and cites nothing", async ({
    page,
  }) => {
    await uploadAndAsk(page, "sourdough bread baking temperatures");

    await expect(
      page.getByText(/couldn't find anything relevant/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /citation/i })).toHaveCount(
      0,
    );
  });

  test("points an upload suggestion at this page, not a workspace", async ({
    page,
  }) => {
    // `/w/${workspaceId}` would be a link to nothing in local mode.
    await uploadAndAsk(page, "sourdough bread baking temperatures");

    await expect(
      page.getByText(/the upload area is at the top of/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("link", { name: /this workspace/i }),
    ).toHaveCount(0);
  });
});
