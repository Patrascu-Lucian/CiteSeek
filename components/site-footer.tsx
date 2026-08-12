import Link from "next/link";

import { REPOSITORY_URL } from "@/lib/links";
import { pageShell } from "@/components/ui/page-shell";

/**
 * Footer for every route. It lived inside the landing page's `<main>`, where **a
 * `<footer>` is not a `contentinfo` landmark** — the role is granted only to one
 * not scoped to a section, so it looked right and exposed nothing.
 *
 * In the root layout, so it reaches `not-found.tsx` and `error.tsx` too.
 */
export function SiteFooter() {
  return (
    <footer className="border-border/60 mt-auto border-t">
      <div className={pageShell("5xl", "text-muted-foreground py-8 text-sm")}>
        {/*
          Names spelled out: "Privacy" alone could be a setting. Right-aligned
          from `md`, measured as where the row below stops wrapping — 640px still
          stacks, 768px does not. Labeled for what it holds, since a landmark
          whose name does not describe its contents is worse than an unnamed one.
        */}
        <nav
          aria-label="About this project"
          className="flex flex-wrap items-center gap-6 md:justify-end"
        >
          {/* About and Contact first: they are what this landmark is named for,
            and the two anyone actually clicks. The policies are reference. */}
          <Link href="/about" className="hover:text-foreground underline">
            About
          </Link>
          {/* The privacy page promises somewhere to send an erasure request, and
            until this link existed that promise pointed at nothing. A repository
            rather than a form, which would need a sender and spam handling to do
            what issues already do. */}
          <a
            href={REPOSITORY_URL}
            className="hover:text-foreground underline"
            target="_blank"
            rel="noreferrer"
          >
            Contact
          </a>
          <Link href="/privacy" className="hover:text-foreground underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground underline">
            Terms of Service
          </Link>
        </nav>

        {/*
          Its own row rather than joining the nav above: that landmark is named
          for pages about the project, and a route the reader can use does not
          belong under it.

          A plain anchor, not <Link> — /local needs the WASM directives its own
          response carries, and a client-side navigation would leave whichever
          page the reader came from governing it (ADR 028). This footer renders
          on every route, so a <Link> here would break local mode from all of
          them rather than from one page.
        */}
        <p className="mt-4 flex flex-wrap items-center gap-2 md:justify-end">
          <a href="/local" className="hover:text-foreground underline">
            Local mode
          </a>
          <span>(Experimental)</span>
        </p>

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
