import { expect, test } from "./signed-in";

test.describe("a provider link that fails", () => {
  test("says so instead of bouncing the reader to their workspace", async ({
    page,
    signedIn,
  }) => {
    // Auth.js sends every `SignInError` to `pages.signIn`, and throws this one
    // before touching the session — so the reader arrives still signed in.
    await page.goto("/sign-in?error=OAuthAccountNotLinked");

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      /already connected to a different citeseek account/i,
    );
    expect(signedIn.userId).toBeTruthy();
  });

  test("offers the way back, not a sign-in they have already done", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/sign-in?error=OAuthAccountNotLinked");

    await expect(
      page.getByRole("button", { name: /continue with/i }),
    ).toHaveCount(0);

    // Followed, not asserted on: a link that lands nowhere is the same dead end.
    await page.getByRole("link", { name: /back to your account/i }).click();

    await expect(
      page.getByRole("heading", { level: 2, name: /sign-in methods/i }),
    ).toBeVisible();
    expect(signedIn.userId).toBeTruthy();
  });

  test("still sends a signed-in reader on when nothing failed", async ({
    page,
    signedIn,
  }) => {
    await page.goto("/sign-in");

    await expect(page).toHaveURL(new RegExp(`/w/${signedIn.workspaceId}`));
  });
});

test.describe("a link the reader cancelled", () => {
  test("says nothing was added, not that signing in went wrong", async ({
    page,
    signedIn,
  }) => {
    // What Google actually sends on Cancel. `AccessDenied` never fires here:
    // it needs a `signIn` callback, and this app defines none.
    await page.goto("/sign-in?error=OAuthCallbackError");

    const alert = page.getByRole("main").getByRole("alert");

    await expect(alert).toContainText(/nothing was added/i);
    await expect(alert).not.toContainText(/went wrong/i);
    expect(signedIn.userId).toBeTruthy();
  });

  test("stops calling itself a sign-in page", async ({ page, signedIn }) => {
    // The `h1` is the page's accessible name, and this reader has an account.
    await page.goto("/sign-in?error=OAuthCallbackError");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /adding a sign-in method/i,
    );
    await expect(page.getByRole("link", { name: /try the demo/i })).toHaveCount(
      0,
    );
    expect(signedIn.userId).toBeTruthy();
  });
});

test.describe("the sign-in methods card", () => {
  test("offers only what is not linked yet", async ({ page, signedIn }) => {
    await signedIn.sql`
      insert into accounts (user_id, type, provider, provider_account_id)
      values (${signedIn.userId}, 'oauth', 'github', ${`gh-${signedIn.userId}`})`;

    await page.goto("/account");

    await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /add google/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /add github/i })).toHaveCount(
      0,
    );
  });
});
