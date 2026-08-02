import Link from "next/link";

/**
 * Footer for every route.
 *
 * It used to live inside the landing page's `<main>`, which was wrong twice
 * over. Discoverability first: the privacy page states what happens to an
 * uploaded document, and it was reachable only from the marketing page — so a
 * signed-in reader standing at the upload control had no route to it from where
 * the question actually occurs to them. A policy nobody can navigate to is a
 * policy written for its author.
 *
 * The second is structural, and worth knowing generally: **a `<footer>` nested
 * inside `<main>` is not a `contentinfo` landmark.** The role is granted only to
 * a footer that is not scoped to an article or section, so the old markup
 * produced a footer that looked right and exposed nothing to a screen reader
 * navigating by landmark. Hoisting it to a direct child of `<body>` in the root
 * layout is what makes it one.
 *
 * Rendered in the root layout rather than in the three group layouts, so it also
 * reaches the root `not-found.tsx` and `error.tsx` — which sit outside every
 * group and therefore have no header at all.
 */
export function SiteFooter() {
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className="text-muted-foreground mx-auto w-full max-w-5xl px-6 py-8 text-sm">
        {/*
          The policies get their own row, above a divider.

          They were sharing a line with the copyright, which put the two things a
          reader might actually click beside the one thing they never will — and
          left them fighting for space on a narrow screen. Their names are spelled
          out for the same reason: "Privacy" alone could be a setting, and someone
          looking for what happens to their documents is scanning for the words
          they already have in mind.
        */}
        {/*
          Right-aligned from `md` up, which is where the row below stops
          wrapping — measured, not guessed: at 640px the description and the
          copyright still stack, at 768px they sit at opposite ends. Above that
          the policies line up exactly with the copyright (both right edges land
          on 1128 at a 1280px viewport). Below it everything is left-aligned,
          because one right-aligned line above two left-aligned ones reads as a
          mistake rather than a choice.
        */}
        <nav
          aria-label="Policies"
          className="flex flex-wrap items-center gap-6 md:justify-end"
        >
          <Link href="/privacy" className="hover:text-foreground underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground underline">
            Terms of Service
          </Link>
        </nav>

        <div className="border-border/60 mt-6 border-t pt-6">
          {/*
            Both lines earn their place. The description tells a stranger what
            this is inside one sentence; the notice says who owns it. The
            repository is public with no license file, so everything is already
            all rights reserved — this states it rather than leaving it to be
            inferred.
          */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p>
              A portfolio project exploring retrieval-augmented generation with
              verifiable citations.
            </p>
            <span>© {new Date().getFullYear()} Lucian Patrascu</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
