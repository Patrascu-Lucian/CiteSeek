import { createHmac } from "node:crypto";

/**
 * Identifying a caller for the purpose of limiting them.
 *
 * A guest's id lives in a cookie they can clear, and `/demo` mints a fresh
 * signed one on every visit — so guest identity is *self-assigned* and useless
 * as a limit key. A bot would simply renew it per request. The only thing an
 * anonymous visitor does not control is the address their packets arrive from,
 * so that is what a guest limit counts.
 *
 * The address itself is never stored. It is reduced to
 * `HMAC-SHA256(ip, AUTH_SECRET)` before it reaches the database, reusing the
 * primitive that already signs guest cookies. Equality on the hash counts
 * identically to equality on the address, so nothing about enforcement changes
 * and the table holds no personal data in the clear.
 *
 * One consequence worth stating: rotating `AUTH_SECRET` re-keys every hash and
 * therefore resets every limit. That is the same trade already accepted for
 * guest cookies, which all stop verifying on rotation.
 */

/**
 * Where the address comes from, in order of trustworthiness.
 *
 * `x-forwarded-for` is client-supplied and trivially spoofed — anyone can send
 * one and claim to be another address. It is last, and only its **first** entry
 * is read, because the leftmost value is the original client while later ones
 * are proxies. Vercel's own headers come first precisely because the platform
 * sets them and a request cannot forge them.
 */
const IP_HEADERS = ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"];

/**
 * Stands in for an address when none is available — local development, the
 * integration suite, anything not behind a proxy.
 *
 * A fixed sentinel rather than `null`: an unkeyed request would be exempt from
 * every limit, and a limiter that silently stops applying off-platform is one
 * nobody would notice was broken.
 */
export const LOCAL_CLIENT_IP = "local";

export function clientIpFrom(headers: Headers): string {
  for (const header of IP_HEADERS) {
    const value = headers.get(header);
    if (!value) continue;

    // Only the first entry. A forwarded chain reads left to right from the
    // original client, and appending to it is how a caller would try to hide.
    const first = value.split(",")[0]?.trim();
    if (first) return first;
  }

  return LOCAL_CLIENT_IP;
}

/**
 * Reduces an address to something countable but not readable.
 *
 * Throws when no secret is configured rather than falling back to storing the
 * address: a missing secret is a misconfiguration, and silently degrading to
 * plaintext personal data is not a degradation anyone would choose.
 */
export function hashClientIp(ip: string, secret = process.env.AUTH_SECRET) {
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required to hash client addresses for usage limiting.",
    );
  }

  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Convenience for route handlers: read the address and hash it in one step. */
export function clientIpHash(
  headers: Headers,
  secret = process.env.AUTH_SECRET,
): string {
  return hashClientIp(clientIpFrom(headers), secret);
}
