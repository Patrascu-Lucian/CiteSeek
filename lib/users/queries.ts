import { eq } from "drizzle-orm";

import { AUTH_PROVIDERS } from "@/lib/auth/providers";
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
      .where(eq(accounts.userId, userId)),
    db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.id, userId)),
  ]);

  const methods = verified[0]?.emailVerified
    ? [...linked, { provider: EMAIL_METHOD }]
    : linked;

  return methods.sort((a, b) => rank(a.provider) - rank(b.provider));
}

/** One rule, sorted in JavaScript rather than half here and half in SQL: an
 * `order by` gave alphabetical and appending gave email-last, which agreed with
 * this only while GitHub led `AUTH_PROVIDERS`. The card the reader sees and the
 * Add buttons beside it now come from the same list. */
function rank(provider: string): number {
  const index = AUTH_PROVIDERS.findIndex(({ id }) => id === provider);

  return index === -1 ? AUTH_PROVIDERS.length : index;
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
