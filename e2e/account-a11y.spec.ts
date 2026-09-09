import { useTheme, violationsOn } from "./axe";
import { expect, test } from "./signed-in";

/** Separate from `a11y.spec.ts` because that sweep takes `test` from Playwright
 * and this needs the signed-in fixture. Does not cover the avatar: it is
 * `aria-hidden`, so axe skips it — its contrast is arithmetic, in
 * `components/ui/avatar.tsx`. */
for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test("the account page, signed in", async ({ page, signedIn }) => {
      expect(signedIn.userId).toBeTruthy();
      await useTheme(page, theme);
      await page.goto("/account");

      await expect(
        page.getByRole("heading", { level: 1, name: /account/i }),
      ).toBeVisible();
      expect(await violationsOn(page)).toEqual([]);
    });

    test("the account page, as a guest", async ({ page }) => {
      // A different page entirely — one card saying there is no account here —
      // and it was as unscanned as the other.
      await page.goto("/demo");
      await useTheme(page, theme);
      await page.goto("/account");

      await expect(
        page.getByRole("heading", { level: 2, name: /guest session/i }),
      ).toBeVisible();
      expect(await violationsOn(page)).toEqual([]);
    });
  });
}
