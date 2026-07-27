import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

/**
 * Guest sessions.
 *
 * A guest is deliberately *not* an Auth.js user. They have no account, own
 * nothing, and may only read the seeded demo workspace. Modeling them as users
 * would mean anonymous rows in `users` and ownership checks special-cased at
 * every call site; keeping them separate leaves authorization as one rule.
 *
 * The token is a signed value rather than an opaque database row so that entering
 * the demo costs no writes -- an unauthenticated visitor should not be able to
 * make us insert anything.
 *
 * Format: `<base64url(payload)>.<base64url(hmac-sha256)>`
 * The payload is readable by design; it carries no secret, only an id and
 * timestamps. The signature is what makes it unforgeable.
 */

export { GUEST_COOKIE_NAME } from "./cookies";

/** Guest sessions are short-lived; a demo visit is minutes, not weeks. */
export const GUEST_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export type GuestPayload = {
  /** Random per-session id. Used for per-guest rate limiting, never for identity. */
  id: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expires-at, epoch seconds. */
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
