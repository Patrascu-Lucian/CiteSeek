import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * No `"use client"`: `MainNav` owns the boundary. `aria-current="page"` is the
 * part that matters — styling alone leaves "where you are" visual-only. No
 * pending indicator either; measuring put that in a `loading.tsx` a layer up,
 * which can say *where* you are going.
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
        // Padding inside the link, so the filled block is the target;
        // `ring-inset` because it touches the header's edges.
        "focus-visible:ring-ring inline-flex items-center px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
        // Weight and color alone were too quiet in a row of four, and an
        // underline competes with the one that means "link". The hover fill
        // matters as much, or the background only appears where you already are.
        isCurrent
          ? "bg-muted text-foreground font-semibold"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium",
        className,
      )}
    >
      {/* The bold copy reserves the width, or becoming current shoves the row. */}
      <span className="grid grid-cols-1 grid-rows-1 place-items-center">
        <span
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 font-semibold"
        >
          {children}
        </span>
        <span className="col-start-1 row-start-1">{children}</span>
      </span>
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
