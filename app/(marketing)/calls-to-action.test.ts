import { describe, expect, it } from "vitest";

import type { Actor } from "@/lib/auth/actor";

import { callsToAction } from "./calls-to-action";

const user: Actor = {
  type: "user",
  id: "u1",
  name: null,
  email: "someone@example.com",
  image: null,
};

const guest: Actor = { type: "guest", id: "g1" };

describe("callsToAction", () => {
  it("offers signup and the demo to a first-time visitor", () => {
    const { primary, secondary } = callsToAction(null);

    expect(primary).toEqual({ href: "/sign-in", label: "Get started" });
    expect(secondary.href).toBe("/demo");
    expect(secondary.label).toMatch(/no signup/i);
  });

  it("sends a signed-in visitor to their workspace", () => {
    // The bug: this page told someone who had already signed up to sign up, and
    // offered them a guest mode they had outgrown.
    const { primary, secondary } = callsToAction(user);

    expect(primary).toEqual({ href: "/w", label: "Go to your workspace" });
    expect(secondary.href).toBe("/demo");
  });

  it("never tells a signed-in visitor there is no signup needed", () => {
    const { primary, secondary } = callsToAction(user);

    for (const cta of [primary, secondary]) {
      expect(cta.label).not.toMatch(/no signup/i);
      expect(cta.href).not.toBe("/sign-in");
    }
  });

  it("returns a guest to the demo they are already in", () => {
    const { primary } = callsToAction(guest);

    expect(primary).toEqual({
      href: "/demo",
      label: "Continue in the demo",
    });
  });

  it("tells a guest what signing in would actually buy them", () => {
    // Not "Get started" — a guest has started. What they cannot do is upload,
    // which is the only reason for them to sign in.
    const { secondary } = callsToAction(guest);

    expect(secondary.href).toBe("/sign-in");
    expect(secondary.label).toMatch(/upload/i);
  });

  it("always offers exactly two distinct destinations", () => {
    for (const actor of [null, user, guest]) {
      const { primary, secondary } = callsToAction(actor);

      expect(primary.href).not.toBe(secondary.href);
      expect(primary.label).not.toBe("");
      expect(secondary.label).not.toBe("");
    }
  });
});
