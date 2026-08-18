import { test as base, type Page } from "@playwright/test";
import postgres from "postgres";

import { assertDisposableDatabase } from "@/lib/env/disposable-database";

/**
 * A signed-in session without OAuth, which no browser test can drive. Sessions
 * are database rows, so the cookie is an opaque primary key and **not a signed
 * token** — inserting the row and setting the cookie is the whole handshake.
 *
 * A user and workspace per test, not one shared account: the suite is
 * `fullyParallel` and the caps count rows.
 */

// Direct writes to `users`, so the integration suite's guard applies here too.
assertDisposableDatabase(process.env);

const sql = postgres(process.env.DATABASE_URL!);

/** Non-secure name because the suite runs over http. Auth.js prefixes it with
 * `__Secure-` once the URL is https, and the cookie would then be ignored. */
const SESSION_COOKIE = "authjs.session-token";

export type SignedIn = {
  userId: string;
  workspaceId: string;
  /** Rows this test may create, cascading from the user on teardown. */
  sql: typeof sql;
};

async function open(page: Page, label: string): Promise<SignedIn> {
  const token = `e2e-${label}-${crypto.randomUUID()}`;
  const [user] = await sql<{ id: string }[]>`
    insert into users (name, email, email_verified)
    values ('E2E', ${`${token}@example.test`}, now())
    returning id`;
  const [workspace] = await sql<{ id: string }[]>`
    insert into workspaces (name, owner_id) values ('E2E workspace', ${user!.id})
    returning id`;
  await sql`
    insert into sessions (session_token, user_id, expires)
    values (${token}, ${user!.id}, now() + interval '1 day')`;

  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return { userId: user!.id, workspaceId: workspace!.id, sql };
}

/**
 * `test` with a `signedIn` fixture. Deleting the user cascades to the workspace,
 * its documents and its conversations, so a run leaves nothing behind for the
 * next one to count.
 */
export const test = base.extend<{ signedIn: SignedIn }>({
  // Named `provide`, not `use`: the React hooks lint rule claims any call to a
  // bare `use` outside a component. Playwright takes it positionally.
  signedIn: async ({ page }, provide, testInfo) => {
    const session = await open(page, testInfo.title.replace(/\W+/g, "-"));

    await provide(session);

    await sql`delete from users where id = ${session.userId}`;
  },
});

export { expect } from "@playwright/test";
