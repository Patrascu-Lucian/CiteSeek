import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts, users } from "@/lib/db/schema";

/**
 * What the account page shows about how someone signs in.
 *
 * Deliberately not the whole `accounts` row: it holds `access_token`,
 * `refresh_token` and `id_token`, none of which anyone needs to see and all of
 * which would then exist in a server-rendered payload. Selecting the two columns
 * that get displayed keeps the credentials out of the page, which is the same
 * reasoning as the explicit column list in `lib/documents/queries.ts` — asking
 * for more than you read turns an unrelated change into an incident.
 */
export type SignInMethod = {
  provider: string;
};

/** Magic link writes no `accounts` row, so it is invisible to the query below.
 * `emailVerified` is where it lands, and only there: the OAuth path creates a
 * user with `emailVerified: null` (`handle-login` :260), so a date on this
 * column means somebody proved they hold the inbox. */
export async function listSignInMethods(
  userId: string,
): Promise<SignInMethod[]> {
  const [linked, verified] = await Promise.all([
    db
      .select({ provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(accounts.provider),
    db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, userId)),
  ]);

  return verified[0]?.emailVerified
    ? [...linked, { provider: EMAIL_METHOD }]
    : linked;
}

/** Not a provider id: nothing signs in "with EMAIL_METHOD", and it must never
 * reach `signIn()` or the `AUTH_<ID>_KEY` lookup. It names a row's absence. */
export const EMAIL_METHOD = "email";

/**
 * Turns a provider id into something worth reading.
 *
 * Falls back to the raw id rather than "Unknown": if a second provider is ever
 * configured and this map is not updated, showing `google` is honest and showing
 * "Unknown" is not.
 */
const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  [EMAIL_METHOD]: "Email link",
};

export function providerLabel(provider: string): string {
  return Object.hasOwn(PROVIDER_LABELS, provider)
    ? PROVIDER_LABELS[provider]!
    : provider;
}
