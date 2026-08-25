import type { Actor } from "@/lib/auth/actor";

/**
 * The landing page rendered "Get started" and "no signup" unconditionally, so a
 * signed-in visitor was invited to sign up — the first page anyone sees and the
 * only one that did not know the actor existed. Pure and its own module so it
 * tests without a session; the `Actor` import is type-only.
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
