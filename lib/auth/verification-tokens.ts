import { lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { verificationTokens } from "@/lib/db/schema";

/**
 * Auth.js deletes a token when the link is **clicked**, and `deleteUserAccount`
 * reaches only the rows whose identifier is a user's address. Neither covers the
 * table's main population: links nobody opened, and links asked for by addresses
 * that never became accounts. Each row holds an address in the clear, and an
 * unauthenticated caller can write them, so nothing bounds the table without
 * this.
 */
export async function pruneVerificationTokens(): Promise<number> {
  const deleted = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expires, sql`now()`))
    .returning({ token: verificationTokens.token });

  return deleted.length;
}
