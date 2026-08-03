import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * A guest is deliberately *not* an Auth.js user: no account, owns nothing, reads
 * only the demo. Modeling them as users would mean anonymous `users` rows and
 * ownership checks special-cased everywhere.
 *
 * A signed token rather than a database row, so entering the demo costs no
 * writes. Format `<base64url(payload)>.<base64url(hmac-sha256)>` — the payload is
 * readable by design and carries no secret; the signature makes it unforgeable.
 */

export { GUEST_COOKIE_NAME } from "./cookies";

/** Guest sessions are short-lived; a demo visit is minutes, not weeks. */
export const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export type GuestPayload = {
  /** Never an identity, and **not** what rate limiting counts: `/demo` mints a
   * fresh cookie per visit, so this is self-assigned and a script gets one per
   * request. Limits count the client address instead (ADR 014). */
  id: string;
  iat: number;
  exp: number;
};

export type GuestVerifyResult =
  | { ok: true; payload: GuestPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
}

/**
 * Constant-time comparison. A plain `===` on a signature leaks, through timing,
 * how many leading bytes an attacker guessed correctly.
 */
function signaturesMatch(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, which would itself be a leak, so
  // the length check is answered separately and the comparison still runs.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export function createGuestToken(
  secret: string,
  options: { now?: Date; id?: string } = {},
): string {
  if (!secret) throw new Error("A secret is required to sign guest tokens.");

  const nowSeconds = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  const payload: GuestPayload = {
    id: options.id ?? randomUUID(),
    iat: nowSeconds,
    exp: nowSeconds + GUEST_SESSION_MAX_AGE_SECONDS,
  };

  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function verifyGuestToken(
  token: string | undefined | null,
  secret: string,
  options: { now?: Date } = {},
): GuestVerifyResult {
  if (!token || !secret) return { ok: false, reason: "malformed" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };

  const [encoded, signature] = parts as [string, string];
  if (!encoded || !signature) return { ok: false, reason: "malformed" };

  // Signature is checked before the payload is trusted enough to parse.
  if (!signaturesMatch(signature, sign(encoded, secret))) {
    return { ok: false, reason: "bad-signature" };
  }

  let payload: GuestPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded)) as GuestPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    typeof payload?.id !== "string" ||
    typeof payload?.iat !== "number" ||
    typeof payload?.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  const nowSeconds = Math.floor((options.now?.getTime() ?? Date.now()) / 1000);
  if (payload.exp <= nowSeconds) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}
