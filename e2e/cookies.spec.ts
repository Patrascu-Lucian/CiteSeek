import { randomUUID } from "node:crypto";

import {
  GUEST_COOKIE_NAME,
  SESSION_COOKIE_NAMES,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/cookies";
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

test("the session cookie ends 30 days after sign-in, however often you visit", async ({
  page,
  context,
  signedIn,
}) => {
  const raw = randomUUID();
  const email = `session-${raw}@example.test`;
  await signedIn.sql`
    insert into verification_tokens (identifier, token, expires)
    values (${email}, ${stored(raw)}, now() + interval '10 minutes')`;

  await context.clearCookies();
  await page.goto(callback(raw, email));

  const sessionCookie = async () => {
    const found = (await context.cookies()).find(
      ({ name }) => name === SESSION_COOKIE_NAMES[0],
    );
    expect(found, "no session cookie").toBeDefined();
    return found!;
  };
  const rowExpires = async (token: string) => {
    const [row] = await signedIn.sql<{ epoch: number }[]>`
      select extract(epoch from expires)::float8 as epoch
      from sessions where session_token = ${token}`;
    return row!.epoch;
  };

  const issued = await sessionCookie();
  expect(
    Math.abs(issued.expires - (Date.now() / 1000 + SESSION_MAX_AGE_SECONDS)),
  ).toBeLessThan(300);

  // Aged past Auth.js's one-day update interval, or the visit below would not
  // try to extend anything and an unmoved cookie would prove nothing.
  await signedIn.sql`
    update sessions set expires = expires - interval '2 days'
    where session_token = ${issued.value}`;
  const aged = await rowExpires(issued.value);

  await page.goto("/account");
  await expect(
    page.getByRole("heading", { level: 1, name: /account/i }),
  ).toBeVisible();

  // The row slid forward and the browser's copy did not: `auth()` in a server
  // component drops the cookie Auth.js refreshes.
  expect((await rowExpires(issued.value)) - aged).toBeGreaterThan(86_400);
  expect((await sessionCookie()).expires).toBe(issued.expires);

  await signedIn.sql`delete from users where email = ${email}`;
});
