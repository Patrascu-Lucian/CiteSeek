/**
 * Where the model weights come from, measured rather than assumed: the file URL
 * on  redirects to a regional CDN ( here), and
 * a redirect target is checked against  in its own right. Wildcards
 * because that prefix is the reader's region, not ours.
 *
 * No document text goes to either — this is a GET for a public model file.
 */
const WEIGHTS_HOSTS =
  "https://huggingface.co https://*.huggingface.co https://*.hf.co";

/** Local inference compiles WebAssembly and spawns a worker; no other route does. */
const WASM_ROUTES = [/^\/local(\/|$)/];

type PolicyOptions = {
  path?: string;
  isProduction?: boolean;
};

/**
 * The policy `proxy.ts` sets on every response. Lives here rather than inline so
 * the directives that differ between environments and routes can be asserted
 * instead of assumed.
 *
 * Options rather than positional flags: `(nonce, true, false)` at a call site is
 * two same-typed booleans that no compiler can tell apart, in the one function
 * where swapping them ships a hole.
 */
export function contentSecurityPolicy(
  nonce: string,
  {
    path = "/",
    isProduction = process.env.NODE_ENV === "production",
  }: PolicyOptions = {},
): string {
  const directives = [
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
  ];

  if (!WASM_ROUTES.some((route) => route.test(path))) {
    return directives.join("; ");
  }

  // Derived from the policy above rather than written out again, so a directive
  // added there cannot be silently dropped here.
  return directives
    .map((directive) =>
      directive.startsWith("script-src")
        ? `${directive} 'wasm-unsafe-eval'`
        : directive,
    )
    .map((directive) =>
      directive.startsWith("connect-src")
        ? `${directive} ${WEIGHTS_HOSTS}`
        : directive,
    )
    .concat("worker-src 'self' blob:")
    .join("; ");
}
