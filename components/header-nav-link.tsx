import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * A navigation link that says where you are. No `"use client"`: `MainNav` owns
 * the boundary, and an entry may not take a plain function prop.
 *
 * `aria-current="page"` is the part that matters — styling alone leaves the
 * information visual-only, the same failure as a styled span standing in for
 * `<strong>`.
 *
 * No pending indicator: measuring showed the feedback belongs a layer up, in a
 * `loading.tsx` boundary that says *where* you are going rather than only that
 * you are waiting.
 */
export function HeaderNavLink({
  href,
  items,
  className,
  onNavigate,
  children,
}: {
  href: string;
  /** "Am I current" cannot be answered by one link once destinations nest. */
  items: readonly { href: string }[];
  className?: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isCurrent = currentHref(pathname, items) === href;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(
        // Padding inside the link, so the filled block is the target. No fixed
        // height: it fills whatever the container gives it. `ring-inset` because
        // the link now touches the header's edges.
        "focus-visible:ring-ring inline-flex items-center px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        // Background, contrast and weight together. Weight and color alone were
        // too quiet to pick out of a row of four, and an underline competes with
        // the one that means "link" elsewhere. The hover fill matters as much:
        // without it the background only ever appears where you already are.
        isCurrent
          ? "bg-muted text-foreground font-semibold"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Longest match wins: on `/w/<id>/usage` you are in Usage, not Workspace, though
 * the workspace href is a prefix. The first nested pair made two links announce
 * "current page" at once. Exported for its own tests — the failure is invisible
 * without a screen reader.
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
