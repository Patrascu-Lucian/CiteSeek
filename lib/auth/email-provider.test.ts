import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as Sweeps from "@/lib/sweeps";

const admit = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const prune = vi.hoisted(() => vi.fn().mockResolvedValue(0));

vi.mock("@/lib/auth/verification-tokens", () => ({
  pruneVerificationTokens: prune,
}));

// The real gate and the real `swallowFailures`, on a clock the test owns: the
// hourly window is module state, so the first case would otherwise sweep and
// silence every one after it. A pass-through stub cannot tell the swallow being
// inside the work from it being around the gate, which is the whole property.
const clock = vi.hoisted(() => ({ at: 0 }));

vi.mock("@/lib/sweeps", async (importOriginal) => {
  const { atMostEvery, swallowFailures } =
    await importOriginal<typeof Sweeps>();
  return {
    atMostEvery,
    swallowFailures,
    pruneExpiredTokens: atMostEvery(60 * 60_000, () => clock.at),
  };
});

// Reaches `lib/db` through the counting query, which a unit test has no
// database for. What it decides is covered by the integration suite.
vi.mock("@/lib/usage/sign-in-links", () => ({ admitSignInLink: admit }));

import { scalewayEmail } from "./email-provider";

type Params = Parameters<
  ReturnType<typeof scalewayEmail>["sendVerificationRequest"]
>[0];

const send = (overrides: Partial<Params> = {}) => {
  const provider = scalewayEmail();

  return provider.sendVerificationRequest({
    identifier: "reader@example.com",
    url: "https://citeseek.app/api/auth/callback/scaleway?token=raw&email=reader%40example.com",
    provider: { ...provider, apiKey: "test-key" },
    request: new Request("https://citeseek.app/api/auth/signin/scaleway", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    }),
    ...overrides,
  } as Params);
};

const sent = () => {
  const [url, init] = vi.mocked(fetch).mock.calls[0]!;
  return {
    url,
    headers: (init!.headers ?? {}) as Record<string, string>,
    body: JSON.parse(init!.body as string) as Record<string, unknown>,
  };
};

beforeEach(() => {
  // `clientIpHash` refuses to hash without it, which is the guard working.
  process.env.AUTH_SECRET ??= "test-secret";
  admit.mockReset().mockResolvedValue(true);
  prune.mockReset().mockResolvedValue(0);
  // Past the hour, so each case starts with the window open.
  clock.at += 60 * 60_000 * 2;
  process.env.SCALEWAY_PROJECT_ID = "proj-1";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.SCALEWAY_PROJECT_ID;
});

describe("the Scaleway email provider", () => {
  it("posts to the Paris region, which is the one the DPA pins", async () => {
    await send();

    expect(sent().url).toBe(
      "https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails",
    );
  });

  it("sends from the verified subdomain, not the apex", async () => {
    // SPF and DKIM authorise `mail.citeseek.app`. The apex is not a sender, and
    // a bounce problem there would follow the domain the app is served from.
    await send();

    expect(sent().body.from).toEqual({
      name: "CiteSeek",
      email: "no-reply@mail.citeseek.app",
    });
  });

  it("carries the key as a header, never in the URL or body", async () => {
    // A query string reaches access logs and a Referer header; a body reaches
    // whatever logs request payloads.
    await send();
    const { url, headers, body } = sent();

    expect(headers["X-Auth-Token"]).toBe("test-key");
    expect(url).not.toContain("test-key");
    expect(JSON.stringify(body)).not.toContain("test-key");
  });

  it("puts the sign-in link in both the text and the HTML part", async () => {
    // Clients that refuse HTML would otherwise get an email with no way in.
    await send();
    const { body } = sent();

    expect(body.text).toContain("token=raw");
    expect(body.html).toContain("token=raw");
  });

  it("expires in fifteen minutes, not the library's twenty-four hours", () => {
    expect(scalewayEmail().maxAge).toBe(15 * 60);
  });

  it("refuses to send with no project id, rather than posting an invalid body", async () => {
    delete process.env.SCALEWAY_PROJECT_ID;

    await expect(send()).rejects.toThrow(/SCALEWAY_PROJECT_ID/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses to send with no key, rather than spending the allowance on a 401", async () => {
    const provider = scalewayEmail();

    await expect(
      send({
        provider: { ...provider, apiKey: undefined },
      }),
    ).rejects.toThrow(/AUTH_SCALEWAY_KEY/);
    expect(admit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("escapes the link rather than trusting how Auth.js built it", async () => {
    await send({ url: 'https://citeseek.app/cb?token=a"><script>x</script>' });

    expect(sent().body.html).not.toContain("<script>");
  });

  it("sweeps for an admitted caller", async () => {
    await send();

    expect(prune).toHaveBeenCalled();
  });

  it("does not sweep for a caller it refused, so the allowance paces it", async () => {
    // Above the admission check an anonymous caller sets the sweep's pace — the
    // gate is process-global, not per-caller. The rows a refused caller leaves
    // are collected by the next admitted one, anywhere.
    admit.mockResolvedValue(false);

    await expect(send()).rejects.toThrow();
    expect(prune).not.toHaveBeenCalled();
  });

  it("sends anyway when the sweep fails, because housekeeping is not the sign-in", async () => {
    prune.mockRejectedValue(new Error("no database"));

    await expect(send()).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalled();
  });

  it("spends the window on a sweep that failed, rather than retrying it per request", async () => {
    // `atMostEvery` advances only once the work resolves, so swallowing around
    // the gate instead of inside the work would let an anonymous caller retry a
    // failing sweep on every request.
    prune.mockRejectedValue(new Error("no database"));

    await send();
    await send();

    expect(prune).toHaveBeenCalledTimes(1);
  });

  it("sweeps once an hour, not once a request", async () => {
    // The positive control: without it the case above passes against a gate
    // that never runs the work at all.
    await send();
    await send();
    expect(prune).toHaveBeenCalledTimes(1);

    clock.at += 60 * 60_000;
    await send();

    expect(prune).toHaveBeenCalledTimes(2);
  });

  it("does not send once the caller has spent their allowance", async () => {
    admit.mockResolvedValue(false);

    await expect(send()).rejects.toThrow(/too many/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses with a client-safe code, not one that says the app is broken", async () => {
    // Any error Auth.js does not recognize becomes `Configuration`, whose copy
    // reads "this is a problem on our side" — false, and it buries a real outage
    // among ordinary throttling.
    admit.mockResolvedValue(false);

    await expect(send()).rejects.toMatchObject({ type: "AccessDenied" });
  });

  it("counts the request before spending it, not after", async () => {
    // A provider that is slow or failing would otherwise be a way to send more
    // than the allowance.
    await send();

    expect(admit.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0]!,
    );
  });

  it("reports a refused send without repeating the address or the link", async () => {
    // The address is personal data and the URL is a live credential: an error
    // that quotes either puts both wherever errors are collected.
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("permission denied"),
    } as unknown as Response);

    await expect(send()).rejects.toThrow(/403 permission denied/);
    // Not `rejects.not.toThrow(address)`, which passes against any message
    // that happens not to contain it — including one no implementation could
    // produce. The URL is checked too: it is the half carrying a credential.
    let message = "";
    try {
      await send();
    } catch (cause) {
      message = (cause as Error).message;
    }

    expect(message).toContain("403 permission denied");
    expect(message).not.toContain("reader@example.com");
    expect(message).not.toContain("token=raw");
  });
});
