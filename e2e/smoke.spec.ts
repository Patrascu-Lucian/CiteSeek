import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders the value proposition and both entry points", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: /ask your documents/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo/i }),
    ).toBeVisible();
  });

  test("exposes a skip link as the first keyboard stop", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: /skip to main content/i });
    await expect(skipLink).toBeFocused();
  });

  test("has a document title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/CiteSeek/);
  });
});

test.describe("the landing page knows who is reading it", () => {
  test("offers signup to a first-time visitor", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo — no signup/i }),
    ).toBeVisible();
  });

  test("offers a returning guest their demo rather than a signup", async ({
    page,
  }) => {
    // The bug this covers: the page rendered "Get started" and "no signup"
    // unconditionally, so someone already inside the demo was invited to sign up
    // for it. It was the first page anyone sees and the only one that did not
    // know the visitor existed.
    await page.goto("/demo");
    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);

    await page.goto("/");

    await expect(
      page.getByRole("link", { name: /continue in the demo/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /get started/i })).toHaveCount(
      0,
    );
  });

  test("shows the header, so a session has an exit from the landing page", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page.goto("/");

    await expect(
      page.getByRole("button", { name: /leave demo/i }),
    ).toBeVisible();
    // "Back to home" would point at the page you are already on.
    await expect(page.getByRole("link", { name: /back to home/i })).toHaveCount(
      0,
    );
  });
});
