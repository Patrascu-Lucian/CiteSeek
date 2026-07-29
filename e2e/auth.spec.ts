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
    // than the proxy's has-a-cookie check.
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

test.describe("navigation", () => {
  test("every page outside the landing page offers a way back", async ({
    page,
  }) => {
    for (const path of ["/sign-in", "/demo-unavailable"]) {
      await page.goto(path);
      await expect(
        page.getByRole("link", { name: /back to home/i }),
      ).toBeVisible();
    }
  });

  test("the back link returns to the landing page", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: /back to home/i }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /ask your documents/i }),
    ).toBeVisible();
  });

  test("the workspace page offers a way back", async ({ page }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("link", { name: /back to home/i }),
    ).toBeVisible();
  });

  test("the back link is the first stop after the skip link", async ({
    page,
  }) => {
    await page.goto("/sign-in");

    await page.keyboard.press("Tab"); // skip link
    await page.keyboard.press("Tab"); // back link

    await expect(
      page.getByRole("link", { name: /back to home/i }),
    ).toBeFocused();
  });

  test("/w sends a guest to the demo workspace", async ({ page }) => {
    await page.goto("/demo");
    await page.goto("/w");

    await expect(page).toHaveURL(/\/w\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /demo/i }),
    ).toBeVisible();
  });

  test("/w sends a signed-out visitor to sign-in", async ({ page }) => {
    await page.goto("/w");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("documents in the demo workspace", () => {
  test("shows the read-only workspace without an upload control", async ({
    page,
  }) => {
    // The demo is shared, seeded state. An upload control that then failed
    // server-side would be worse than not offering it.
    await page.goto("/demo");

    await expect(
      page.getByRole("heading", { level: 2, name: /documents/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /drop files here/i }),
    ).toHaveCount(0);
    await expect(page.getByText(/read-only/i).first()).toBeVisible();
  });

  test("offers no destructive controls to a read-only visitor", async ({
    page,
  }) => {
    await page.goto("/demo");

    await expect(page.getByRole("button", { name: /^delete/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /retry/i })).toHaveCount(0);
  });

  test("lists the seeded document, so there is something to ask about", async ({
    page,
  }) => {
    // This used to assert the empty state. The demo is now seeded with a
    // fixture, because a guest can only read it — without a document, every
    // question returns the same refusal and the demo shows nothing of what the
    // product does. The empty state itself is covered in `document-list.test.tsx`,
    // where it can be rendered on demand rather than depending on seed data.
    await page.goto("/demo");

    await expect(
      page.getByText(/northwind-remote-work-handbook/i),
    ).toBeVisible();
    await expect(page.getByText(/no documents yet/i)).toHaveCount(0);
  });

  test("offers a guest no account-deletion control", async ({ page }) => {
    // A guest has no account. Showing the control would promise something the
    // route rejects.
    await page.goto("/demo");

    await expect(
      page.getByRole("button", { name: /delete account/i }),
    ).toHaveCount(0);
  });
});

test.describe("ending a session", () => {
  test("a guest can leave the demo and the session is actually gone", async ({
    page,
    context,
  }) => {
    // The assertion that matters is the second navigation, not the redirect: a
    // button that returns you home while leaving the cookie in place looks
    // identical and logs nobody out.
    await page.goto("/demo");
    const workspaceUrl = page.url();

    await page.getByRole("button", { name: /leave demo/i }).click();
    await expect(page).toHaveURL(/\/$/);

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "citeseek.guest")).toBeUndefined();

    await page.goto(workspaceUrl);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("shows the guest they are in a guest session", async ({ page }) => {
    await page.goto("/demo");

    await expect(page.getByText(/guest session/i)).toBeVisible();
  });

  test("offers no session exit to a visitor who has none", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("button", { name: /leave demo|sign out/i }),
    ).toHaveCount(0);
  });

  test("the exit control is keyboard operable", async ({ page }) => {
    await page.goto("/demo");

    const leave = page.getByRole("button", { name: /leave demo/i });
    await leave.focus();
    await expect(leave).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/$/);
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

    const cta = page.getByRole("link", { name: /get started/i });

    // Tabs until the control is reached rather than pressing Tab a fixed number
    // of times. The header sits between the skip link and the call to action, so
    // a hard-coded count asserts the shape of the navigation instead of the
    // thing that matters — that a keyboard user can get there at all. It broke
    // the moment the header was added to this page, which is a change in layout
    // rather than a regression in access.
    for (let i = 0; i < 10; i += 1) {
      if (await cta.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }

    await expect(cta).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
