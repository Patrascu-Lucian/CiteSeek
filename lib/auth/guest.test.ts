import { describe, expect, it } from "vitest";

import {
  GUEST_SESSION_MAX_AGE_SECONDS,
  createGuestToken,
  verifyGuestToken,
} from "./guest";

const SECRET = "test-secret-not-used-anywhere-real";
const OTHER_SECRET = "a-different-secret";
const NOW = new Date("2026-07-27T12:00:00.000Z");

describe("createGuestToken", () => {
  it("produces a two-part token", () => {
    const token = createGuestToken(SECRET, { now: NOW });
    expect(token.split(".")).toHaveLength(2);
  });

  it("issues a distinct id per session", () => {
    const a = createGuestToken(SECRET, { now: NOW });
    const b = createGuestToken(SECRET, { now: NOW });
    expect(a).not.toBe(b);
  });

  it("refuses to sign without a secret", () => {
    expect(() => createGuestToken("")).toThrow(/secret/i);
  });
});

describe("verifyGuestToken", () => {
  it("accepts a token it just issued", () => {
    const token = createGuestToken(SECRET, { now: NOW, id: "guest-1" });
    const result = verifyGuestToken(token, SECRET, { now: NOW });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.id).toBe("guest-1");
      expect(result.payload.exp - result.payload.iat).toBe(
        GUEST_SESSION_MAX_AGE_SECONDS,
      );
    }
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty string", ""],
    ["no separator", "abcdef"],
    ["too many parts", "a.b.c"],
    ["empty signature", "abc."],
  ])("rejects a malformed token (%s)", (_label, token) => {
    const result = verifyGuestToken(token, SECRET, { now: NOW });
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects a token signed with a different secret", () => {
    const token = createGuestToken(OTHER_SECRET, { now: NOW });
    const result = verifyGuestToken(token, SECRET, { now: NOW });

    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a tampered payload", () => {
    const token = createGuestToken(SECRET, { now: NOW, id: "guest-1" });
    const [, signature] = token.split(".");

    // Re-encode the payload claiming a far-future expiry, keeping the original
    // signature. This is the attack the signature exists to stop.
    const forged = Buffer.from(
      JSON.stringify({ id: "guest-1", iat: 0, exp: 99_999_999_999 }),
      "utf8",
    ).toString("base64url");

    const result = verifyGuestToken(`${forged}.${signature}`, SECRET, {
      now: NOW,
    });

    expect(result).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects an expired token", () => {
    const token = createGuestToken(SECRET, { now: NOW });
    const afterExpiry = new Date(
      NOW.getTime() + (GUEST_SESSION_MAX_AGE_SECONDS + 1) * 1000,
    );

    const result = verifyGuestToken(token, SECRET, { now: afterExpiry });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a token that expires exactly now", () => {
    // Boundary: `exp <= now` is expired, so a token is not valid on its own
    // expiry second.
    const token = createGuestToken(SECRET, { now: NOW });
    const atExpiry = new Date(
      NOW.getTime() + GUEST_SESSION_MAX_AGE_SECONDS * 1000,
    );

    expect(verifyGuestToken(token, SECRET, { now: atExpiry })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("accepts a token one second before expiry", () => {
    const token = createGuestToken(SECRET, { now: NOW });
    const justBefore = new Date(
      NOW.getTime() + (GUEST_SESSION_MAX_AGE_SECONDS - 1) * 1000,
    );

    expect(verifyGuestToken(token, SECRET, { now: justBefore }).ok).toBe(true);
  });

  it("rejects valid-looking base64 that is not a guest payload", () => {
    const encoded = Buffer.from(JSON.stringify({ hello: "world" })).toString(
      "base64url",
    );
    // Sign it correctly, so only the shape check can catch it.
    const token = createGuestToken(SECRET, { now: NOW });
    const [, sig] = token.split(".");

    const result = verifyGuestToken(`${encoded}.${sig}`, SECRET, { now: NOW });
    expect(result.ok).toBe(false);
  });

  it("rejects when no secret is supplied", () => {
    const token = createGuestToken(SECRET, { now: NOW });
    expect(verifyGuestToken(token, "", { now: NOW })).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});
