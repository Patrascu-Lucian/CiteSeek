import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";

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

export async function listSignInMethods(
  userId: string,
): Promise<SignInMethod[]> {
  return db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}

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
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}
