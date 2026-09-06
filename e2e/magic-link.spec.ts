import { createHash, randomUUID } from "node:crypto";

import { expect, test } from "./signed-in";

// Auth.js stores `SHA-256(rawToken + AUTH_SECRET)`, never the token it emailed,
// so a link can be minted here and no mail need be sent.
const stored = (raw: string) =>
  createHash("sha256")
    .update(`${raw}${process.env.AUTH_SECRET ?? ""}`)
    .digest("hex");

const callback = (raw: string, email: string) =>
  `/api/auth/callback/scaleway?token=${raw}&email=${encodeURIComponent(email)}`;

test.describe("a magic link", () => {
  test("signs in the address it was issued for", async ({ page, signedIn }) => {
    const raw = randomUUID();
    const email = `magic-${raw}@example.test`;

    await signedIn.sql`
      insert into verification_tokens (identifier, token, expires)
      values (${email}, ${stored(raw)}, now() + interval '10 minutes')`;

    // Or the fixture's cookie decides this before the token is read.
    await page.context().clearCookies();
    await page.goto(callback(raw, email));

    // Not the destination: `redirectTo` rides a cookie `signIn()` sets, and this
    // flow never called it.
    await expect(page).not.toHaveURL(/\/sign-in/);

    await page.goto("/account");
    await expect(
      page.getByRole("heading", { level: 1, name: /account/i }),
    ).toBeVisible();
  });

  test("refuses a token that was not the one issued", async ({
    page,
    signedIn,
  }) => {
    // The row exists and the link does not match it — without which the test
    // above passes against a lookup by identifier alone.
    const email = `magic-${randomUUID()}@example.test`;

    await signedIn.sql`
      insert into verification_tokens (identifier, token, expires)
      values (${email}, ${stored(randomUUID())}, now() + interval '10 minutes')`;

    await page.context().clearCookies();
    await page.goto(callback(randomUUID(), email));

    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page).not.toHaveURL(/\/w/);
  });

  test("refuses a link that has expired", async ({ page, signedIn }) => {
    const raw = randomUUID();
    const email = `magic-${raw}@example.test`;

    await signedIn.sql`
      insert into verification_tokens (identifier, token, expires)
      values (${email}, ${stored(raw)}, now() - interval '1 minute')`;

    await page.context().clearCookies();
    await page.goto(callback(raw, email));

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("spends the token, so the same link cannot be used twice", async ({
    page,
    signedIn,
  }) => {
    // A sign-in link sits in an inbox for as long as the inbox exists.
    const raw = randomUUID();
    const email = `magic-${raw}@example.test`;

    await signedIn.sql`
      insert into verification_tokens (identifier, token, expires)
      values (${email}, ${stored(raw)}, now() + interval '10 minutes')`;

    await page.context().clearCookies();
    await page.goto(callback(raw, email));
    await expect(page).not.toHaveURL(/\/sign-in/);

    await page.context().clearCookies();
    await page.goto(callback(raw, email));

    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("asking for a link", () => {
  test("offers an email field beside the providers", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with email/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /continue with github/i }),
    ).toBeVisible();
  });

  test("does not name the address on the page that follows", async ({
    page,
  }) => {
    // No session there, so the address could only come from the querystring.
    await page.goto("/check-your-email");

    await expect(
      page.getByRole("heading", { level: 1, name: /check your email/i }),
    ).toBeVisible();
    await expect(page.getByText("@")).toHaveCount(0);
  });
});
