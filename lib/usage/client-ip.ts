import { createHmac } from "node:crypto";

/**
 * Identifying a caller for the purpose of limiting them.
 *
 * A guest's id lives in a cookie they can clear, and `/demo` mints a fresh one
 * per visit — so guest identity is self-assigned and useless as a limit key. The
 * only thing an anonymous visitor does not control is the address their packets
 * arrive from.
 *
 * The address is never stored: it is reduced to `HMAC-SHA256(ip, AUTH_SECRET)`
 * before reaching the database. Equality on the hash counts identically, so
 * enforcement is unchanged and the table holds no personal data in the clear.
 *
 * Rotating `AUTH_SECRET` re-keys every hash and resets every limit — the same
 * trade already accepted for guest cookies.
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
