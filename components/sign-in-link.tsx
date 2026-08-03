"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { HEADER_CONTROL_HEIGHT } from "@/components/header-control-height";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The way in, for anyone without an account. It replaced "Leave demo" for guests:
 * abandoning read access to a public demo exposes nothing, so the header spent
 * its one slot on the action nobody wanted. That exit moved to `/account`.
 *
 * A client component because the answer depends on the path.
 */
export function SignInLink({ className }: { className?: string }) {
  // Nothing to offer on the page itself — the form is already the whole screen.
  if (usePathname() === "/sign-in") return null;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(HEADER_CONTROL_HEIGHT, className)}
    >
      {/* No `callbackUrl`: sign-in lands on the workspace, which is where someone
        who just signed in wants to be, rather than back on the terms page. */}
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}
