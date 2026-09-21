import type { Actor } from "@/lib/auth/actor";

/**
 * The landing page rendered "Get started" and "no signup" unconditionally, so a
 * signed-in visitor was invited to sign up — the first page anyone sees and the
 * only one that did not know the actor existed. Pure and its own module so it
 * tests without a session; the `Actor` import is type-only.
 */

export type CallToAction = { href: string; label: string };

/** The foot of the page, for a reader who got there. Its label is deliberately
 * not the hero's: two links with the same name in one link list are a
 * screen-reader nuisance, and it would void the entry-link count in
 * `smoke.spec.ts`. */
export type ClosingCallToAction = {
  heading: string;
  body: string;
  action: CallToAction;
};

export type LandingCallsToAction = {
  primary: CallToAction;
  secondary: CallToAction;
  /** What trying it costs, for a reader who has not. Absent once they have an
   * account or a guest session, where it would answer a question they have
   * already asked. */
  note?: string;
  closing: ClosingCallToAction;
};

export function callsToAction(actor: Actor): LandingCallsToAction {
  if (actor?.type === "user") {
    return {
      primary: { href: "/w", label: "Go to your workspace" },
      secondary: { href: "/demo", label: "Open the demo" },
      closing: {
        heading: "Your workspace is where this applies",
        body: "The retrieval, the markers and the refusal all run the same way on the documents you upload.",
        action: { href: "/w", label: "Open your workspace" },
      },
    };
  }

  if (actor?.type === "guest") {
    return {
      primary: { href: "/demo", label: "Continue in the demo" },
      // Not "Get started" — a guest has started. What they have not done is
      // gained the ability to upload, which is the actual reason to sign in.
      secondary: { href: "/sign-in", label: "Sign in to upload your own" },
      closing: {
        heading: "The demo cannot take a file of yours",
        body: "It is read-only, and that is the one thing signing in changes: your own documents, in a workspace only you can query.",
        action: { href: "/sign-in", label: "Sign in to upload a file" },
      },
    };
  }

  // The demo first: the filled button is the one a stranger clicks, and it
  // should reach the product rather than a form. The label stays a command; what
  // it costs goes underneath, where a sentence belongs.
  return {
    primary: { href: "/demo", label: "Try the demo" },
    secondary: { href: "/sign-in", label: "Sign in to upload your own" },
    note: "No account. No card. Nothing to install.",
    closing: {
      heading: "One document is already in there",
      body: "A fictional company handbook, parsed into passages that kept their page numbers. Ask it something and follow a marker back to the line it came from.",
      action: { href: "/demo", label: "Open the demo workspace" },
    },
  };
}
