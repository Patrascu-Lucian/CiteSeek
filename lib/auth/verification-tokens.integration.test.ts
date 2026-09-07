import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  clearVerificationTokens,
  createTestClient,
} from "@/lib/db/test-helpers";
import { verificationTokens } from "@/lib/db/schema";

import { pruneVerificationTokens } from "./verification-tokens";

const { client, db } = createTestClient();

const link = (identifier: string, expires: Date) =>
  db.insert(verificationTokens).values({
    identifier,
    token: `token-${identifier}`,
    expires,
  });

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

beforeEach(() => clearVerificationTokens(db));

afterAll(async () => {
  await clearVerificationTokens(db);
  await client.end();
});

describe("pruning sign-in tokens", () => {
  it("removes a link nobody clicked", async () => {
    // Auth.js deletes a token when it is *used*. Unused ones are the majority
    // and each holds an address in the clear.
    await link("stale@example.test", hoursFromNow(-1));

    expect(await pruneVerificationTokens()).toBe(1);
    expect(await db.select().from(verificationTokens)).toEqual([]);
  });

  it("leaves a link that is still good", async () => {
    // The positive control: a prune that took everything would also pass the
    // test above, and would sign nobody in.
    await link("live@example.test", hoursFromNow(1));

    expect(await pruneVerificationTokens()).toBe(0);
    expect(await db.select().from(verificationTokens)).toHaveLength(1);
  });

  it("keeps the live one while taking the expired one", async () => {
    await link("stale@example.test", hoursFromNow(-1));
    await link("live@example.test", hoursFromNow(1));

    expect(await pruneVerificationTokens()).toBe(1);

    const [row] = await db
      .select({ identifier: verificationTokens.identifier })
      .from(verificationTokens);

    expect(row?.identifier).toBe("live@example.test");
  });
});
