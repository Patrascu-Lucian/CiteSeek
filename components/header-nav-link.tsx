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
 * the weight and the underline. Styling alone would leave the information
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
  excludes,
  children,
}: {
  href: string;
  /**
   * A path under `href` that must *not* count as the current page.
   *
   * `/w` covers every workspace, including the shared demo — so for a signed-in
   * reader visiting the demo, a plain prefix match would underline "Workspace"
   * while they are somewhere that is not theirs. The nav would be making a
   * claim the page contradicts. Guests pass nothing here: the demo *is* their
   * workspace, so marking it is correct.
   */
  excludes?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  /*
    Exact match for "/", prefix match otherwise. `/w` has to stay marked while
    reading `/w/<id>`, but a prefix match on "/" would mark home as the current
    page everywhere in the app.
  */
  const matchesHref =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const isExcluded =
    excludes !== undefined &&
    (pathname === excludes || pathname.startsWith(`${excludes}/`));

  const isCurrent = matchesHref && !isExcluded;

  return (
    <Link
      href={href}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        isCurrent
          ? "text-foreground underline decoration-2 underline-offset-4"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
