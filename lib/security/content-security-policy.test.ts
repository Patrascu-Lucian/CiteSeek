import { describe, expect, it } from "vitest";

import { contentSecurityPolicy } from "./content-security-policy";

const NONCE = "dGVzdC1ub25jZQ==";

describe("contentSecurityPolicy", () => {
  it("never allows eval in production", () => {
    // The whole reason the relaxation below is a parameter rather than a constant.
    expect(contentSecurityPolicy(NONCE, true)).not.toContain("unsafe-eval");
  });

  it("allows eval outside production, because React's dev build needs it", () => {
    expect(contentSecurityPolicy(NONCE, false)).toContain("'unsafe-eval'");
  });

  it("carries the nonce and keeps `unsafe-inline` out of script-src", () => {
    const directives = contentSecurityPolicy(NONCE, true).split("; ");
    const scriptSrc = directives.find((d) => d.startsWith("script-src"))!;

    expect(scriptSrc).toContain(`'nonce-${NONCE}'`);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("keeps the directives that stop a model-authored image phoning home", () => {
    const policy = contentSecurityPolicy(NONCE, true);

    expect(policy).toContain("img-src 'self' data:");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
  });

  it("differs between environments in exactly one directive", () => {
    // A relaxation that quietly widened something else would pass every check
    // above; this is the one that would catch it.
    const production = contentSecurityPolicy(NONCE, true).split("; ");
    const development = contentSecurityPolicy(NONCE, false).split("; ");

    const differing = production.filter((d, i) => d !== development[i]);

    expect(differing).toHaveLength(1);
    expect(differing[0]).toContain("script-src");
  });
});
