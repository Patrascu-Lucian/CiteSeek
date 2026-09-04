import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.hoisted(() => vi.fn());
const getActor = vi.hoisted(() => vi.fn());

// Both reach a database through Auth.js, which a unit test has no business
// opening — the branches under test are reached before either would matter.
vi.mock("@/auth", () => ({ signIn, signOut: vi.fn() }));
vi.mock("./actor", () => ({ getActor }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ delete: vi.fn() }),
}));

import { linkProviderAction } from "./actions";

const signedIn = { type: "user", id: "u1", name: null, email: null };

beforeEach(() => {
  signIn.mockReset();
  getActor.mockReset();
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

  it("checks the provider before it checks anything else", async () => {
    // Order matters: an unconfigured provider must not reach `signIn` even for
    // a reader whose session is perfectly good.
    getActor.mockResolvedValue(signedIn);

    await expect(linkProviderAction("facebook")).rejects.toThrow(
      /unknown sign-in provider/i,
    );
  });

  it("refuses to link without a session", async () => {
    // Its own doc calls the session what makes linking safe. Without this the
    // call degrades to an ordinary sign-in, which is a different operation.
    getActor.mockResolvedValue(null);

    await expect(linkProviderAction("google")).rejects.toThrow(
      /needs a signed-in session/i,
    );

    expect(signIn).not.toHaveBeenCalled();
  });

  it("refuses a guest, who has no account to link to", async () => {
    getActor.mockResolvedValue({ type: "guest", id: "g1" });

    await expect(linkProviderAction("google")).rejects.toThrow(
      /needs a signed-in session/i,
    );

    expect(signIn).not.toHaveBeenCalled();
  });

  it("returns the reader to the account page, not the workspace", async () => {
    // `/w` would drop them somewhere that says nothing about what just
    // happened to the thing they were changing.
    await linkProviderAction("google");

    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/account" });
  });
});
