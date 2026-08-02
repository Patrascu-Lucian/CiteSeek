import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * A navigation link that says where you are.
 *
 * No `"use client"` of its own — see `MainNav`, which owns the boundary this
 * sits behind. It carried one until the nav grew a container; being imported
 * directly by the server-rendered header made it an entry, and an entry may not
 * take a plain function prop like `onNavigate`.
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
  items,
  className,
  onNavigate,
  children,
}: {
  href: string;
  /**
   * Every destination in the nav. Needed because "am I the current page" cannot
   * be answered by one link alone once destinations nest — see `MainNav`.
   */
  items: readonly { href: string }[];
  className?: string;
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCurrent = currentHref(pathname, items) === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
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
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Which single destination the reader is currently in.
 *
 * Longest match wins, which is the rule a reader already assumes: standing on
 * `/w/<id>/usage` you are in Usage, not in Workspace, even though the workspace
 * href is a prefix of it. Before Usage existed no destination contained another
 * and every link could answer for itself; the first nested pair made two links
 * announce "current page" at once.
 *
 * Exported for its own tests — the rule is small and the failure it prevents is
 * invisible without a screen reader.
 */
export function currentHref(
  pathname: string,
  items: readonly { href: string }[],
): string | null {
  const matches = items.filter((item) =>
    // "/" would otherwise prefix-match every route in the app.
    item.href === "/"
      ? pathname === "/"
      : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return matches.reduce<string | null>(
    (best, item) =>
      best === null || item.href.length > best.length ? item.href : best,
    null,
  );
}
