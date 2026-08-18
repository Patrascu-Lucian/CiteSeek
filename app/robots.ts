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
      disallow: [...SIDE_EFFECT_ROUTES, "/api/", "/account"],
    },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
