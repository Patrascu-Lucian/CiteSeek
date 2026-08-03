"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The wordmark, which is also the way home.
 *
 * A logo linking home is a convention, not a label — nothing on screen says so,
 * and it is the one navigation control here with no visible text. The tooltip
 * says it, and only where it is true: on the home page the link points at the
 * page you are already on, so it gets `aria-current` instead.
 */
export function HomeLink({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const isHome = usePathname() === "/";

  return (
    <Link
      href="/"
      className={className}
      // The accessible name comes from the wordmark text. `title` adds the hint
      // for a pointer without renaming the link for a screen reader.
      title={isHome ? undefined : "Back to home"}
      aria-current={isHome ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
