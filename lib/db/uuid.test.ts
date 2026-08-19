import { describe, expect, it } from "vitest";

import { isUuid } from "./uuid";

describe("isUuid", () => {
  it("accepts what randomUUID produces", () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
  });

  it("accepts either case, because Postgres returns lowercase", () => {
    expect(isUuid("A1B2C3D4-1111-2222-3333-444455556666")).toBe(true);
  });

  it.each([
    ["a word", "garbage"],
    ["empty", ""],
    ["no hyphens", "a1b2c3d411112222333344445555666"],
    ["too short a group", "a1b2c3d4-111-2222-3333-444455556666"],
    ["a trailing character", "a1b2c3d4-1111-2222-3333-444455556666x"],
    [
      "braces, which Postgres would accept",
      "{a1b2c3d4-1111-2222-3333-444455556666}",
    ],
    ["whitespace around a valid one", " a1b2c3d4-1111-2222-3333-444455556666 "],
  ])("rejects %s", (_label, value) => {
    expect(isUuid(value)).toBe(false);
  });

  it("rejects a SQL fragment, which is the shape an attacker sends", () => {
    // Drizzle parameterizes, so this was never injectable — it was a 500.
    expect(isUuid("' OR 1=1 --")).toBe(false);
  });
});
