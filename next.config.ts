import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Naming the framework and version tells an attacker which CVEs to try.
  poweredByHeader: false,

  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
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
