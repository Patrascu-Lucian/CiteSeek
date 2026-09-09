import type { MetadataRoute } from "next";

import { SIDE_EFFECT_ROUTES } from "@/lib/links";
import { siteUrl } from "@/lib/site-url";

/**
 * `/w/*` already answers 404 to anyone without access, so this is about traffic
 * rather than secrecy: a crawled `/demo` mints a guest session per visit and
 * then follows a redirect to a workspace it cannot read.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // `/maintenance` is reachable directly even when nothing is rewritten to
      // it, and an indexed holding page outlives the maintenance by weeks.
      disallow: [...SIDE_EFFECT_ROUTES, "/api/", "/account", "/maintenance"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
