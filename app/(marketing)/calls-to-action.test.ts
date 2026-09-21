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
  it("sends a first-time visitor to the demo before any form", () => {
    const { primary, secondary } = callsToAction(null);

    expect(primary).toEqual({ href: "/demo", label: "Try the demo" });
    expect(secondary.href).toBe("/sign-in");
    expect(secondary.label).toMatch(/upload/i);
  });

  it("answers what the demo costs, in a sentence rather than in the label", () => {
    const { primary, note } = callsToAction(null);

    expect(primary.label).toBe("Try the demo");
    expect(note).toMatch(/no account/i);
  });

  it("says nothing about accounts to a visitor who has one, or a session", () => {
    // The same bug as the labels below, one line lower: "No account" under a
    // button that opens their own workspace.
    expect(callsToAction(user).note).toBeUndefined();
    expect(callsToAction(guest).note).toBeUndefined();
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

  it("closes on the step the reader has not taken yet", () => {
    expect(callsToAction(null).closing.action).toEqual({
      href: "/demo",
      label: "Open the demo workspace",
    });
    // A guest is already in the demo, so the demo is not the next step.
    expect(callsToAction(guest).closing.action.href).toBe("/sign-in");
    expect(callsToAction(user).closing.action.href).toBe("/w");
  });

  it("never gives the closing link a name the hero already used", () => {
    // One accessible name, two links: indistinguishable in a link list, and the
    // entry-link count in `smoke.spec.ts` stops meaning anything.
    for (const actor of [null, user, guest]) {
      const { primary, secondary, closing } = callsToAction(actor);

      expect([primary.label, secondary.label]).not.toContain(
        closing.action.label,
      );
      expect(closing.heading).not.toBe("");
      expect(closing.body).not.toBe("");
    }
  });

  it("tells a guest the demo is the thing that cannot take their file", () => {
    expect(callsToAction(guest).closing.heading).toMatch(/cannot take a file/i);
  });
});
