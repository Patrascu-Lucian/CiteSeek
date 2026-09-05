import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.hoisted(() => vi.fn());
const getActor = vi.hoisted(() => vi.fn());
// Throws, because the real one does: a mock that returns lets the code under
// test run on past a redirect it would never have survived.
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);

// Both reach a database through Auth.js, which a unit test has no business
// opening — the branches under test are reached before either would matter.
vi.mock("@/auth", () => ({ signIn, signOut: vi.fn() }));
vi.mock("./actor", () => ({ getActor }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ delete: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import { linkProviderAction } from "./actions";

const signedIn = { type: "user", id: "u1", name: null, email: null };

beforeEach(() => {
  signIn.mockReset();
  getActor.mockReset();
  redirect.mockClear();
  getActor.mockResolvedValue(signedIn);
});

describe("linkProviderAction", () => {
  it("refuses a provider that is not configured", async () => {
    // A server action is a public endpoint, so the bound argument is not the
    // only value this can be called with.
    await expect(linkProviderAction("evil")).rejects.toThrow(
      /unknown sign-in provider/i,
    );

    expect(signIn).not.toHaveBeenCalled();
  });

  it("checks the provider before it looks up a session", async () => {
    // The assertion the name promises. Reordered guards would leave the throw
    // identical and this the only thing that noticed.
    await expect(linkProviderAction("facebook")).rejects.toThrow(
      /unknown sign-in provider/i,
    );

    expect(getActor).not.toHaveBeenCalled();
  });

  it("sends an expired session to sign in rather than crashing", async () => {
    // Revoking a session is supported, so this is reachable without forgery.
    getActor.mockResolvedValue(null);

    await expect(linkProviderAction("google")).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirect).toHaveBeenCalledWith("/sign-in?callbackUrl=/account");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("does the same for a guest, who has no account to link to", async () => {
    getActor.mockResolvedValue({ type: "guest", id: "g1" });

    await expect(linkProviderAction("google")).rejects.toThrow(/NEXT_REDIRECT/);

    expect(redirect).toHaveBeenCalledWith("/sign-in?callbackUrl=/account");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("returns the reader to the account page, not the workspace", async () => {
    // `/w` would drop them somewhere that says nothing about what just
    // happened to the thing they were changing.
    await linkProviderAction("google");

    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/account" });
  });
});
