import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exhausted = vi.hoisted(() => vi.fn().mockResolvedValue(false));
const record = vi.hoisted(() => vi.fn());

// Reaches `lib/db` through the counting query, which a unit test has no
// database for. What it decides is covered by the integration suite.
vi.mock("@/lib/usage/sign-in-links", () => ({
  signInLinksExhausted: exhausted,
  recordSignInLink: record,
}));

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
  exhausted.mockReset().mockResolvedValue(false);
  record.mockReset();
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

  it("does not send once the caller has spent their allowance", async () => {
    exhausted.mockResolvedValue(true);

    await expect(send()).rejects.toThrow(/too many/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("counts the request before spending it, not after", async () => {
    // A provider that is slow or failing would otherwise be a way to send more
    // than the allowance.
    await send();

    expect(record.mock.invocationCallOrder[0]).toBeLessThan(
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
    await expect(send()).rejects.not.toThrow(/reader@example\.com/);
  });
});
