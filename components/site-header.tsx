import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { leaveDemoAction, signOutAction } from "@/lib/auth/actions";
import { getActor } from "@/lib/auth/actor";

/**
 * Header for every route outside the landing page.
 *
 * The "back" affordance is a Link to an explicit destination rather than a
 * `history.back()` button. A history-based control does something different
 * depending on how you arrived — and does nothing at all when the page was
 * opened from a pasted link, which is exactly how an interviewer will arrive.
 * A link always goes somewhere predictable and works with middle-click,
 * open-in-new-tab, and keyboard activation for free.
 *
 * Ending a session is offered here because there is nowhere else for it to
 * live yet, and a session with no exit is a trap: a shared machine keeps the
 * next person signed in as you.
 */
export async function SiteHeader({
  backHref = "/",
  backLabel = "Back to home",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  const actor = await getActor();

  return (
    <header className="border-border/60 border-b">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-4">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>

        <span aria-hidden="true" className="text-border">
          /
        </span>

        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          CiteSeek
        </Link>

        {actor ? (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {actor.type === "user"
                ? (actor.email ?? actor.name ?? "Signed in")
                : "Guest session"}
            </span>

            {/*
              Two different operations behind one visual affordance. A signed-in
              user has a session row Auth.js must delete; a guest has only a
              signed cookie and nothing server-side.
            */}
            <form
              action={actor.type === "user" ? signOutAction : leaveDemoAction}
            >
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden="true" className="size-4" />
                {actor.type === "user" ? "Sign out" : "Leave demo"}
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </header>
  );
}
