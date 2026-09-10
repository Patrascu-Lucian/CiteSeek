import { expect, test } from "@playwright/test";

import { MAINTENANCE_PORT } from "./ports";

/** The one server in the run held down, because `MAINTENANCE` is read per
 * request and set per process. `proxy.test.ts` asserts the response this code
 * builds; only a served request shows what Next does with it. */
const held = `http://localhost:${MAINTENANCE_PORT}`;

test.use({ baseURL: held });

test.describe("with the site held down", () => {
  test("answers every route 503, not a 200 that reads as healthy", async ({
    request,
  }) => {
    for (const path of ["/", "/account", "/w/anything", "/privacy"]) {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status(), path).toBe(503);
    }
  });

  test("names a retry interval", async ({ request }) => {
    const response = await request.get("/");

    expect(response.headers()["retry-after"]).toBe("600");
  });

  test("keeps the URL the reader asked for", async ({ page }) => {
    // A rewrite, not a redirect: the address bar still says where they were
    // going, so a refresh lands there once the site is back.
    await page.goto("/account");

    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /down for maintenance/i }),
    ).toBeVisible();
  });

  test("serves a policy the page can actually satisfy", async ({ request }) => {
    // The header and the page are built by different passes through the proxy,
    // and a mismatch blocks every script under `strict-dynamic` while the page
    // still looks right. Read from the raw body, not the DOM: browsers blank the
    // `nonce` attribute after parsing so a CSS selector cannot read it back.
    const response = await request.get("/");
    const nonce = /'nonce-([^']+)'/.exec(
      response.headers()["content-security-policy"] ?? "",
    )?.[1];

    expect(nonce).toBeTruthy();
    expect(await response.text()).toContain(`nonce="${nonce!}"`);
  });

  test("runs clean under its own policy", async ({ page }) => {
    // The behavioral half of the check above: a blocked script reports here.
    const violations: string[] = [];
    page.on("console", (message) => {
      if (/Content Security Policy/i.test(message.text()))
        violations.push(message.text());
    });

    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: /down for maintenance/i }),
    ).toBeVisible();

    expect(violations).toEqual([]);
  });

  test("still serves the assets the page is built from", async ({
    page,
    request,
  }) => {
    // Excluded by the proxy matcher, so a 503 here would take the icon and the
    // stylesheet down with the rest and leave an unstyled holding page.
    expect((await request.get("/icon.png")).status()).toBe(200);

    await page.goto("/");
    const stylesheet = await page
      .locator('link[rel="stylesheet"]')
      .first()
      .getAttribute("href");

    expect(stylesheet).toBeTruthy();
    expect((await request.get(stylesheet!)).status()).toBe(200);
  });
});
