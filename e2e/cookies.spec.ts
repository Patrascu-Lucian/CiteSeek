import { randomUUID } from "node:crypto";

import { GUEST_COOKIE_NAME, SESSION_COOKIE_NAMES } from "@/lib/auth/cookies";
import { THEME_COOKIE_NAME } from "@/lib/theme/theme";

import { hydrated, THEME_BUTTON } from "./hydration";
import { expect, test } from "./signed-in";
import { callback, stored } from "./sign-in-link";

const unprefixed = (name: string) => name.replace(/^__(Secure|Host)-/, "");

test("every cookie the site sets is named on the privacy page", async ({
  page,
  context,
  signedIn,
}) => {
  // After each step, not once at the end: a later step can clear an earlier
  // cookie, and a list read once would never see it.
  const seen = new Set<string>();
  const collect = async () => {
    for (const { name } of await context.cookies()) seen.add(unprefixed(name));
  };

  await context.clearCookies();

  await page.goto("/demo");
  await collect();

  await hydrated(page, THEME_BUTTON);
  await page.getByRole("button", { name: "Dark" }).click();
  await expect
    .poll(async () => (await context.cookies()).map(({ name }) => name))
    .toContain(THEME_COOKIE_NAME);
  await collect();

  // Through Auth.js's own callback, which sets its sign-in cookies. Not the
  // email form: that sends real mail.
  const raw = randomUUID();
  const email = `cookies-${raw}@example.test`;
  await signedIn.sql`
    insert into verification_tokens (identifier, token, expires)
    values (${email}, ${stored(raw)}, now() + interval '10 minutes')`;
  await page.goto(callback(raw, email));
  await collect();

  await page.goto("/privacy");
  await collect();

  // Or a flow that stopped setting cookies would pass on an empty set.
  expect([...seen]).toEqual(
    expect.arrayContaining([
      GUEST_COOKIE_NAME,
      THEME_COOKIE_NAME,
      SESSION_COOKIE_NAMES[0],
    ]),
  );

  const listed = page.locator("#cookies");
  for (const name of seen) {
    await expect(listed.getByText(name, { exact: true }), name).toBeVisible();
  }

  await signedIn.sql`delete from users where email = ${email}`;
});
