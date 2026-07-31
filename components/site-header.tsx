import Link from "next/link";
import { LogOut } from "lucide-react";

import { HeaderNavLink } from "@/components/header-nav-link";
import { Button } from "@/components/ui/button";
import { leaveDemoAction, signOutAction } from "@/lib/auth/actions";
import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";

/**
 * Header for every route, including the landing page.
 *
 * It used to be a back link, a wordmark, and account deletion. That shape was a
 * consequence of there being only two destinations and nowhere else to put an
 * exit — the comment it carried said as much. There are three destinations now,
 * so this is navigation, and two things changed with it:
 *
 * - **The back link is gone.** With real links to Workspace and Account it was
 *   redundant with the wordmark, which already points home. Its own comment
 *   noted the redundancy on the landing page; adding navigation made that true
 *   everywhere.
 * - **Account deletion moved to `/account`.** An irreversible action does not
 *   belong one stray click from a wordmark on every route, with no room to say
 *   what it destroys.
 *
 * Ending a session stays here. A session with no visible exit is a trap on a
 * shared machine, and that is true on every page rather than only on the one
 * page someone thought to navigate to.
 */
export async function SiteHeader() {
  const actor = await getActor();

  /*
    Only for a signed-in reader, and only to decide whether "Workspace" is the
    current page. `/w` covers every workspace including the demo, so without
    this the link stays marked as current while they read a workspace that is not
    theirs.

    Guarded on `type === "user"` so the query never runs for a guest or an
    anonymous visitor: a guest's workspace *is* the demo, so there is nothing to
    exclude, and an anonymous visitor gets no nav links at all. That keeps the
    landing page — the one every reader hits first — at the same number of
    queries it had before.
  */
  const demoPath =
    actor?.type === "user"
      ? await findDemoWorkspace().then((demo) =>
          demo ? `/w/${demo.id}` : undefined,
        )
      : undefined;

  return (
    <header className="border-border/60 border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-4"
      >
        {/*
          The wordmark is the link home and is deliberately *not* a nav link: it
          is the product's name, it should look the same everywhere, and marking
          it as the current page on the landing page would make the identity
          flicker as you move around.
        */}
        <Link
          href="/"
          className="focus-visible:ring-ring rounded-md text-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:outline-none"
        >
          CiteSeek
        </Link>

        {/*
          Only for someone who has somewhere to go. An anonymous visitor has no
          workspace and no account, so linking to either would be offering a
          redirect to sign-in dressed up as a destination.
        */}
        {actor ? (
          <div className="flex items-center gap-4">
            {/*
              One link, labelled for who is reading it. `/w` is polymorphic: it
              sends a signed-in user to their personal workspace and a guest to
              the demo. Calling it "Workspace" for a guest is a small lie — the
              only workspace they can reach is the shared, read-only demo, and
              the label should say so before they arrive.

              Deliberately not two links. A separate "Demo" tab would resolve to
              the *same page* as this one for a guest, and a signed-in reader
              already has "Open the demo" on the landing page — one click from
              the wordmark — so a permanent slot would buy a third route to
              content that is one hop away.
            */}
            <HeaderNavLink href="/w" excludes={demoPath}>
              {actor.type === "guest" ? "Demo workspace" : "Workspace"}
            </HeaderNavLink>
            <HeaderNavLink href="/account">Account</HeaderNavLink>
          </div>
        ) : null}

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
      </nav>
    </header>
  );
}
