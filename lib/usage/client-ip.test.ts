import { afterEach, describe, expect, it, vi } from "vitest";

import {
  LOCAL_CLIENT_IP,
  clientIpFrom,
  clientIpHash,
  hashClientIp,
} from "./client-ip";

const SECRET = "test-secret-not-a-real-one";

afterEach(() => vi.unstubAllEnvs());

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe("clientIpFrom", () => {
  it("prefers the platform header over anything the client sent", () => {
    // The whole point. `x-forwarded-for` is client-supplied: anyone can send one
    // and claim to be another address, which would hand them a fresh rate-limit
    // bucket per request.
    const ip = clientIpFrom(
      headers({
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": "9.9.9.9",
      }),
    );

    expect(ip).toBe("9.9.9.9");
  });

  it("falls back through x-real-ip before trusting x-forwarded-for", () => {
    const ip = clientIpFrom(
      headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "8.8.8.8" }),
    );

    expect(ip).toBe("8.8.8.8");
  });

  it("reads only the first entry of a forwarded chain", () => {
    // Left to right, the first value is the original client and the rest are
    // proxies. Appending to the chain is how a caller would try to hide.
    expect(
      clientIpFrom(headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("trims whitespace around a forwarded entry", () => {
    expect(
      clientIpFrom(headers({ "x-forwarded-for": "  1.2.3.4 , 5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("uses a fixed sentinel when no header is present", () => {
    // Not null. An unkeyed request would be exempt from every limit, and a
    // limiter that stops applying off-platform is one nobody notices is broken.
    expect(clientIpFrom(headers({}))).toBe(LOCAL_CLIENT_IP);
  });

  it("ignores an empty header rather than keying on the empty string", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": "" }))).toBe(
      LOCAL_CLIENT_IP,
    );
  });

  it("ignores a chain that is only commas", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": " , , " }))).toBe(
      LOCAL_CLIENT_IP,
    );
  });
});

describe("hashClientIp", () => {
  it("never returns the address it was given", () => {
    const hash = hashClientIp("203.0.113.7", SECRET);

    expect(hash).not.toContain("203.0.113.7");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is stable, so the same caller lands in the same bucket", () => {
    expect(hashClientIp("203.0.113.7", SECRET)).toBe(
      hashClientIp("203.0.113.7", SECRET),
    );
  });

  it("separates different addresses", () => {
    expect(hashClientIp("203.0.113.7", SECRET)).not.toBe(
      hashClientIp("203.0.113.8", SECRET),
    );
  });

  it("re-keys entirely when the secret rotates", () => {
    // Documented consequence: rotating AUTH_SECRET resets every limit, the same
    // trade already accepted for guest cookies.
    expect(hashClientIp("203.0.113.7", SECRET)).not.toBe(
      hashClientIp("203.0.113.7", "a-different-secret"),
    );
  });

  it("refuses to run without a secret rather than storing the address", () => {
    // A missing secret is a misconfiguration. Falling back to plaintext personal
    // data is not a degradation anyone would choose.
    //
    // Arranged, not assumed: the parameter defaults to the environment, so any
    // shell exporting `AUTH_SECRET` turned this green without the guard holding.
    vi.stubEnv("AUTH_SECRET", "");

    expect(() => hashClientIp("203.0.113.7", undefined)).toThrow(
      /AUTH_SECRET is required/i,
    );
  });
});

describe("clientIpHash", () => {
  it("resolves and hashes in one step", () => {
    const hash = clientIpHash(
      headers({ "x-vercel-forwarded-for": "203.0.113.7" }),
      SECRET,
    );

    expect(hash).toBe(hashClientIp("203.0.113.7", SECRET));
  });

  it("gives a spoofed header a different bucket from the real one", () => {
    const spoofed = clientIpHash(
      headers({ "x-forwarded-for": "1.2.3.4" }),
      SECRET,
    );
    const real = clientIpHash(
      headers({
        "x-forwarded-for": "1.2.3.4",
        "x-vercel-forwarded-for": "9.9.9.9",
      }),
      SECRET,
    );

    expect(spoofed).not.toBe(real);
  });
});
