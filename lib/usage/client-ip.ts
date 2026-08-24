import { createHmac } from "node:crypto";

/**
 * A guest's cookie id is self-assigned — `/demo` mints a fresh one per visit — so
 * the address is the only thing an anonymous caller does not control. Stored only
 * as `HMAC-SHA256(ip, AUTH_SECRET)`: equality still counts, so enforcement is
 * unchanged and no address is in the clear. Rotating `AUTH_SECRET` re-keys every
 * hash and resets every limit.
 */

/**
 * In order of trustworthiness. `x-forwarded-for` is client-supplied and trivially
 * spoofed, so it is last; Vercel's own headers cannot be forged by a request.
 */
const IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"];

/**
 * Stands in when no address is available — local development, the integration
 * suite. A fixed sentinel rather than `null`, because an unkeyed request would be
 * exempt from every limit and nobody would notice.
 */
export const LOCAL_CLIENT_IP = "local";

export function clientIpFrom(headers: Headers): string {
  for (const header of IP_HEADERS) {
    const value = headers.get(header);
    if (!value) continue;

    // Leftmost entry only: a forwarded chain reads left to right from the
    // original client, and appending to it is how a caller would try to hide.
    const first = value.split(",")[0]?.trim();
    if (first) return first;
  }

  return LOCAL_CLIENT_IP;
}

/**
 * Throws on a missing secret rather than storing the address: silently degrading
 * to plaintext personal data is not a degradation anyone would choose.
 */
export function hashClientIp(ip: string, secret = process.env.AUTH_SECRET) {
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required to hash client addresses for usage limiting.",
    );
  }

  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Read the address and hash it in one step. */
export function clientIpHash(
  headers: Headers,
  secret = process.env.AUTH_SECRET,
): string {
  return hashClientIp(clientIpFrom(headers), secret);
}
