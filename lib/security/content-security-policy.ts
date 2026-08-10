/**
 * The policy `proxy.ts` sets on every response. Lives here rather than inline so
 * the one directive that differs between environments can be asserted instead of
 * assumed.
 */
export function contentSecurityPolicy(
  nonce: string,
  isProduction = process.env.NODE_ENV === "production",
): string {
  return [
    "default-src 'self'",
    // `strict-dynamic` covers the chunks the nonced bootstrap loads; browsers
    // that ignore it fall back to the `'self'` beside it.
    //
    // React's *development* build calls `eval()` to rebuild callstacks across the
    // server/client boundary, which is most of what RSC debugging is. Production
    // React never does, so the relaxation is gated rather than shipped.
    // `strict-dynamic` ignores `'self'` and host allowlists but not this.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      isProduction ? "" : " 'unsafe-eval'"
    }`,
    // Tailwind and Radix set element styles at runtime; no nonce path for those.
    "style-src 'self' 'unsafe-inline'",
    // No remote hosts: a model-authored image cannot phone home.
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
