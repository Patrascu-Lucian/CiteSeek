import Link from "next/link";

import { REPOSITORY_URL } from "@/lib/links";

/**
 * Footer for every route. It lived inside the landing page's `<main>`, which was
 * wrong twice: the privacy page was reachable only from marketing, and **a
 * `<footer>` inside `<main>` is not a `contentinfo` landmark** — the role is
 * granted only to one not scoped to a section, so it looked right and exposed
 * nothing.
 *
 * In the root layout rather than the three group layouts, so it also reaches
 * `not-found.tsx` and `error.tsx`, which have no header at all.
 */
export function SiteFooter() {
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className="text-muted-foreground mx-auto w-full max-w-5xl px-6 py-8 text-sm">
        {/*
          Its own row above a divider, with names spelled out: "Privacy" alone
          could be a setting, and someone looking for what happens to their
          documents scans for the words they already have in mind.

          Right-aligned from `md` up, which is where the row below stops wrapping
          — measured: 640px still stacks, 768px does not. Below that everything is
          left-aligned, since one right-aligned line above two left ones reads as
          a mistake.

          Labeled "About this project": a landmark whose name does not describe
          its contents is worse than an unnamed one.
        */}
        <nav
          aria-label="About this project"
          className="flex flex-wrap items-center gap-6 md:justify-end"
        >
          <Link href="/about" className="hover:text-foreground underline">
            About
          </Link>
          <Link href="/privacy" className="hover:text-foreground underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground underline">
            Terms of Service
          </Link>
          {/*
            The privacy page promises somewhere to send an erasure request, and
            until this link existed that promise pointed at nothing. A repository
            rather than a form: a form needs an email sender, spam handling and
            rate limiting to do what issues already do.
          */}
          <a
            href={REPOSITORY_URL}
            className="hover:text-foreground underline"
            target="_blank"
            rel="noreferrer"
          >
            Contact
          </a>
        </nav>

        <div className="border-border/60 mt-6 border-t pt-6">
          {/* The repository is public with no license file, so everything is
            already all rights reserved — stated rather than inferred. */}
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
