import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "./content-security-policy";

const NONCE = "dGVzdC1ub25jZQ==";

const directivesOf = (policy: string) => policy.split("; ");

const named = (policy: string, name: string) =>
  directivesOf(policy).find((directive) => directive.startsWith(`${name} `));

describe("contentSecurityPolicy", () => {
  it("never allows eval in production", () => {
    // The whole reason the relaxation below is a parameter rather than a constant.
    expect(contentSecurityPolicy(NONCE, { isProduction: true })).not.toContain(
      "unsafe-eval",
    );
  });

  it("allows eval outside production, because React's dev build needs it", () => {
    expect(contentSecurityPolicy(NONCE, { isProduction: false })).toContain(
      "'unsafe-eval'",
    );
  });

  it("carries the nonce and keeps `unsafe-inline` out of script-src", () => {
    const scriptSrc = named(
      contentSecurityPolicy(NONCE, { isProduction: true }),
      "script-src",
    )!;

    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("keeps the directives that stop a model-authored image phoning home", () => {
    const policy = contentSecurityPolicy(NONCE, { isProduction: true });

    expect(policy).toContain("img-src 'self' data:");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("differs between environments in exactly one directive", () => {
    // A relaxation that quietly widened something else would pass every check
    // above; this is the one that would catch it.
    const production = directivesOf(
      contentSecurityPolicy(NONCE, { isProduction: true }),
    );
    const development = directivesOf(
      contentSecurityPolicy(NONCE, { isProduction: false }),
    );

    const differing = production.filter((d, i) => d !== development[i]);

    expect(differing).toHaveLength(1);
    expect(differing[0]).toContain("script-src");
  });

  describe("on /local, where inference runs in the browser", () => {
    const local = () =>
      contentSecurityPolicy(NONCE, { path: "/local", isProduction: true });

    it("allows WebAssembly compilation", () => {
      // `strict-dynamic` ignores `'self'` and host allowlists, but not this
      // keyword — which is why the model cannot be loaded without it.
      expect(named(local(), "script-src")).toContain("'wasm-unsafe-eval'");
    });

    it("allows a blob worker, which `default-src 'self'` otherwise blocks", () => {
      expect(named(local(), "worker-src")).toBe("worker-src 'self' blob:");
    });

    it("still refuses eval, which is a different capability", () => {
      // `wasm-unsafe-eval` is not a weaker `unsafe-eval`: it permits WebAssembly
      // compilation and no JavaScript evaluation at all.
      expect(named(local(), "script-src")).not.toContain("'unsafe-eval'");
    });

    it("relaxes exactly two directives and widens no host", () => {
      // The guard on the whole seam. Milestone 6's policy is the baseline, and a
      // route-scoped relaxation that leaked into `connect-src` or `img-src` would
      // pass every check above.
      const tight = directivesOf(
        contentSecurityPolicy(NONCE, { path: "/", isProduction: true }),
      );
      const loose = directivesOf(local());

      expect(loose.filter((d) => !tight.includes(d))).toEqual([
        `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' 'wasm-unsafe-eval'`,
        "worker-src 'self' blob:",
      ]);
      expect(tight.filter((d) => !loose.includes(d))).toEqual([
        `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`,
      ]);
    });

    it("names no remote host yet, so weights cannot be fetched", () => {
      // Deliberate, and the reason ADR 028 exists: the download that would name
      // the host has not been run. This test fails the day one is added without
      // the ADR being revisited.
      expect(named(local(), "connect-src")).toBe("connect-src 'self'");
    });
  });

  describe("every other route", () => {
    it.each([
      "/",
      "/demo",
      "/sign-in",
      "/w/abc/chat/def",
      "/localhost",
      "/localised",
    ])("gets the tight policy at %s", (path) => {
      expect(contentSecurityPolicy(NONCE, { path, isProduction: true })).toBe(
        contentSecurityPolicy(NONCE, { path: "/", isProduction: true }),
      );
    });

    it("relaxes /local's children, since a worker page may live under it", () => {
      expect(contentSecurityPolicy(NONCE, { path: "/local/chat" })).toContain(
        "worker-src",
      );
    });
  });
});
