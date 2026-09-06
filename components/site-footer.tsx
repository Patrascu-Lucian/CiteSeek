import Link from "next/link";

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
        {/* Two columns above a phone: one row of names was the old layout and
          `flex-wrap` stranded a lone one in between. Nested groups rather than a
          flat grid, so adding a link cannot regroup the columns. */}
        <nav
          aria-label="This project"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-3">
            <Link href="/about" className="hover:text-foreground underline">
              About
            </Link>
            <Link href="/contact" className="hover:text-foreground underline">
              Contact
            </Link>
            {/* A plain anchor: /local needs the headers its own response
              carries, and a client navigation keeps the previous page's
              (ADR 028). */}
            <a href="/local" className="hover:text-foreground underline">
              Local mode (Experimental)
            </a>
          </div>

          {/* Flush right from `sm`, so the pair reads as one group pinned to the
            edge rather than a second column starting mid-container. Left-aligned
            on a phone, where there is only one column and a ragged left edge
            would be the odd thing. */}
          <div className="flex flex-col gap-3 sm:items-end">
            <Link href="/privacy" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground underline">
              Terms of Service
            </Link>
          </div>
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
