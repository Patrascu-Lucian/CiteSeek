import type { NextConfig } from "next";

/** `script-src` is the weak line: the App Router inlines the RSC payload, so
 * dropping `'unsafe-inline'` needs a per-request nonce — see `docs/backlog.md`. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Tailwind and Radix both set element styles at runtime.
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

const nextConfig: NextConfig = {
  // Naming the framework and version tells an attacker which CVEs to try.
  poweredByHeader: false,

  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // For browsers that do not read `frame-ancestors`.
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ]);
  },
};

export default nextConfig;
