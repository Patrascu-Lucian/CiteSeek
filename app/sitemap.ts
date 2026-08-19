import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/** Everything a stranger can read without an account, and nothing else — a
 * sitemap listing pages that 404 for the crawler is a worse signal than none. */
const PUBLIC_PATHS = ["/", "/about", "/local", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, base).href,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
