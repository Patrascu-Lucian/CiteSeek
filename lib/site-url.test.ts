import { describe, expect, it } from "vitest";

import { siteUrl } from "./site-url";

describe("siteUrl", () => {
  it("prefers the canonical URL production pins", () => {
    expect(siteUrl({ AUTH_URL: "https://citeseek.app" }).href).toBe(
      "https://citeseek.app/",
    );
  });

  // Previews leave AUTH_URL unset so the host comes from the request; a card
  // built there should still point at the deployment that served it.
  it("falls back to the preview deployment", () => {
    expect(siteUrl({ VERCEL_URL: "citeseek-abc123.vercel.app" }).href).toBe(
      "https://citeseek-abc123.vercel.app/",
    );
  });

  it("takes the canonical URL over the preview when both are set", () => {
    expect(
      siteUrl({ AUTH_URL: "https://citeseek.app", VERCEL_URL: "x.vercel.app" })
        .hostname,
    ).toBe("citeseek.app");
  });

  // Wrong in production, obvious in development — the safer way to be wrong.
  it("falls back to localhost rather than nothing", () => {
    expect(siteUrl({}).href).toBe("http://localhost:3000/");
  });
});
