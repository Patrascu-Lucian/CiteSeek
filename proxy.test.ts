import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { proxy } from "./proxy";

const get = (path: string) =>
  proxy(new NextRequest(new URL(path, "https://citeseek.app")));

afterEach(() => {
  delete process.env.MAINTENANCE;
});

describe("the maintenance switch", () => {
  it("answers 503, not a 200 that tells crawlers the site is fine", () => {
    // A holding page served as 200 is the soft-404 defect in another costume:
    // monitoring and search engines both read it as a healthy site.
    process.env.MAINTENANCE = "on";

    expect(get("/").status).toBe(503);
  });

  it("asks for a retry rather than leaving the interval to guesswork", () => {
    process.env.MAINTENANCE = "on";

    expect(get("/").headers.get("Retry-After")).toBe("600");
  });

  it("rewrites rather than redirects, so the reader keeps the URL they asked for", () => {
    process.env.MAINTENANCE = "on";
    const response = get("/w/some-workspace");

    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/maintenance",
    );
  });

  it("still carries a policy, because a 503 is a rendered page", () => {
    // It renders our markup with our scripts; nothing about the status makes
    // the page safe to serve unprotected.
    process.env.MAINTENANCE = "on";

    expect(get("/").headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'",
    );
  });

  it("leaves the holding page itself reachable, or the rewrite has nowhere to land", () => {
    process.env.MAINTENANCE = "on";

    expect(get("/maintenance").status).not.toBe(503);
  });

  it("does nothing at all when the flag is unset", () => {
    expect(get("/").status).not.toBe(503);
    expect(get("/").headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("is on for the one value, not for any truthy string", () => {
    // `MAINTENANCE=off` reading as "on" is the way a switch like this takes a
    // site down by accident.
    process.env.MAINTENANCE = "off";

    expect(get("/").status).not.toBe(503);
  });
});
