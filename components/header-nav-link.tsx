"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * A navigation link that says where you are.
 *
 * Nothing marked the current page before this — every destination looked
 * identical whichever one you were on. `aria-current="page"` is the part that
 * matters: a screen reader announces "current page", and a sighted reader gets
 * the weight and the contrast. Styling alone would leave the information
 * visual-only, which is the same failure as a `<span class="font-semibold">`
 * standing in for `<strong>`.
 *
 * This deliberately carries no pending indicator. An earlier version did, using
 * `useLinkStatus`, until measuring showed the feedback belongs a layer up: a
 * `loading.tsx` boundary lets the router commit the route immediately and stream
 * the page into it, which is both quicker to perceive and says *where* you are
 * going. A spinner beside the link only ever describes the wait.
 */
export function HeaderNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  /*
    Exact match for "/", prefix match otherwise, so `/w/<id>` stays marked while
    reading a conversation inside it — but a prefix match on "/" would mark home
    as current everywhere in the app.

    This used to need an `excludes` prop, because the workspace link pointed at
    `/w`, which is a prefix of *every* workspace including the shared demo: a
    signed-in reader browsing the demo saw "Workspace" marked as current while
    the page said otherwise. The header now links to the specific workspace, so
    a different one simply does not match and the special case is gone.
  */
  const isCurrent =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring rounded-md text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        /*
          Weight and color, not an underline. Two signals rather than one, which
          matters because weight alone between `medium` and `semibold` is a
          subtle difference — the shift from muted to full-contrast text is what
          actually carries it at a glance.

          An underline was the first attempt and reads as dated; it also
          competes with the underline that means "link" elsewhere on the page,
          which is a real ambiguity rather than only a stylistic one.
        */
        isCurrent
          ? "text-foreground font-semibold"
          : "text-muted-foreground hover:text-foreground font-medium",
      )}
    >
      {children}
    </Link>
  );
}
