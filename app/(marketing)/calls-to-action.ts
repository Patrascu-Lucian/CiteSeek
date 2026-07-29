import type { Actor } from "@/lib/auth/actor";

/**
 * What the landing page offers, given who is reading it.
 *
 * The page used to render "Get started" and "Try the demo — no signup"
 * unconditionally: a signed-in visitor was told to sign up, and offered a guest
 * mode they had already outgrown. It was the first page anyone sees and the only
 * one that did not know the actor existed.
 *
 * Kept as a pure function in its own module so the logic can be tested without
 * an auth session or a database. The `Actor` import is type-only, so nothing
 * here pulls Auth.js into a unit test.
 */

export type CallToAction = { href: string; label: string };

export type LandingCallsToAction = {
  primary: CallToAction;
  secondary: CallToAction;
};

export function callsToAction(actor: Actor): LandingCallsToAction {
  if (actor?.type === "user") {
    return {
      primary: { href: "/w", label: "Go to your workspace" },
      secondary: { href: "/demo", label: "Open the demo" },
    };
  }

  if (actor?.type === "guest") {
    return {
      primary: { href: "/demo", label: "Continue in the demo" },
      // Not "Get started" — a guest has started. What they have not done is
      // gained the ability to upload, which is the actual reason to sign in.
      secondary: { href: "/sign-in", label: "Sign in to upload your own" },
    };
  }

  return {
    primary: { href: "/sign-in", label: "Get started" },
    secondary: { href: "/demo", label: "Try the demo — no signup" },
  };
}
