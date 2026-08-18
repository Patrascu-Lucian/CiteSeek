import { describe, expect, it } from "vitest";

import { SIDE_EFFECT_ROUTES } from "@/lib/links";

import robots from "./robots";
import sitemap from "./sitemap";

const rules = robots().rules;
const disallowed = (Array.isArray(rules) ? rules[0]! : rules)
  .disallow as string[];
const urls = sitemap().map((entry) => entry.url);

describe("what crawlers are told to skip", () => {
  // A crawl of one mints a guest session, or follows a redirect to a 404.
  it("covers every GET that writes", () => {
    for (const route of SIDE_EFFECT_ROUTES) {
      expect(disallowed).toContain(route);
    }
  });

  it("keeps the API and the account page out", () => {
    expect(disallowed).toContain("/api/");
    expect(disallowed).toContain("/account");
  });

  it("points at the sitemap absolutely, or it cannot be fetched", () => {
    expect(robots().sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });
});

describe("what the sitemap offers", () => {
  it("lists only pages a stranger can read", () => {
    expect(urls.map((url) => new URL(url).pathname).sort()).toEqual([
      "/",
      "/about",
      "/local",
      "/privacy",
      "/terms",
    ]);
  });

  /* A sitemap and a disallow rule that disagree is a worse signal than either
     alone — the crawler is invited and refused in the same breath. */
  it("offers nothing it also forbids", () => {
    for (const url of urls) {
      const path = new URL(url).pathname;
      for (const rule of disallowed) {
        expect(path.startsWith(rule)).toBe(false);
      }
    }
  });

  it("uses absolute URLs, which the format requires", () => {
    for (const url of urls) expect(url).toMatch(/^https?:\/\//);
  });
});
