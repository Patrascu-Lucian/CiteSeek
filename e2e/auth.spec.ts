import { expect, test } from "@playwright/test";

test.describe("guest mode", () => {
  test("a visitor can enter the demo and see the workspace without signing up", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /try the demo/i }).click();

    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /demo/i }),
    ).toBeVisible();
    await expect(page.getByText(/read-only demo/i)).toBeVisible();
  });

  test("the demo is read-only, offering sign-in rather than upload", async ({
    page,
  }) => {
    await page.goto("/demo");

    await expect(
      page.getByRole("heading", { level: 2, name: /documents/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /sign in to upload/i }),
    ).toBeVisible();
  });

  test("guest access survives a reload", async ({ page }) => {
    await page.goto("/demo");
    const workspaceUrl = page.url();

    await page.reload();

    await expect(page).toHaveURL(workspaceUrl);
    await expect(
      page.getByRole("heading", { level: 1, name: /demo/i }),
    ).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("a signed-out visitor is redirected to sign-in, not shown an error", async ({
    page,
  }) => {
    await page.goto("/w/00000000-0000-0000-0000-000000000000");

    await expect(page).toHaveURL(/\/sign-in\?callbackUrl=/);
    await expect(
      page.getByRole("heading", { name: /sign in to citeseek/i }),
    ).toBeVisible();
  });

  test("a guest cannot reach a workspace that is not the demo", async ({
    page,
  }) => {
    // Establish a guest session first, so this exercises authorization rather
    // than the middleware's has-a-cookie check.
    await page.goto("/demo");
    await page.goto("/w/00000000-0000-0000-0000-000000000000");

    // Denied and not-found are intentionally the same response, so workspace ids
    // cannot be enumerated by comparing them.
    await expect(
      page.getByRole("heading", { name: /workspace not available/i }),
    ).toBeVisible();
  });

  test("a tampered guest cookie is rejected", async ({ page, context }) => {
    await page.goto("/demo");
    const workspaceUrl = page.url();

    const cookies = await context.cookies();
    const guestCookie = cookies.find((c) => c.name === "citeseek.guest");
    expect(guestCookie).toBeDefined();

    // Flip the payload while keeping a plausible shape. The HMAC must reject it.
    await context.clearCookies();
    await context.addCookies([
      {
        ...guestCookie!,
        value: `${Buffer.from(
          JSON.stringify({ id: "forged", iat: 0, exp: 99999999999 }),
        ).toString("base64url")}.notavalidsignature`,
      },
    ]);

    await page.goto(workspaceUrl);

    await expect(
      page.getByRole("heading", { name: /workspace not available/i }),
    ).toBeVisible();
  });
});

test.describe("sign-in page", () => {
  test("offers GitHub and links to the demo", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("button", { name: /continue with github/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /try the demo/i }),
    ).toBeVisible();
  });

  test("is reachable by keyboard from the landing page", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // "Get started"

    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
