import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { HeaderNavLink } from "@/components/header-nav-link";
import { Button } from "@/components/ui/button";
import { leaveDemoAction, signOutAction } from "@/lib/auth/actions";
import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";
import { findPersonalWorkspace } from "@/lib/workspaces/personal";

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
    Resolve the workspace here so the link points at it directly.

    `/w` is a route handler that redirects, which made clicking "Workspace" two
    full page navigations: one to `/w`, which resolves the caller and answers
    307, then one to `/w/<id>`. Neither is a client-side transition, so the
    router never commits and `loading.tsx` never renders — the previous page
    simply sat there until both round trips finished. Locally that is ~40ms and
    invisible; on a cold serverless function it is two cold starts back to back
    with nothing on screen, which is the "did my click register?" complaint.

    Linking straight to `/w/<id>` makes it one client-side transition, so the
    skeleton appears immediately and the redirect disappears entirely.

    A read, never a write: `findPersonalWorkspace` only looks. Creating one stays
    in the route handler, which is what `/w` still exists for and where a request
    that writes belongs. A reader who has no workspace yet — the first visit
    after signing in — falls back to `/w` and pays the redirect exactly once.
  */
  const workspaceHref =
    actor?.type === "user"
      ? await findPersonalWorkspace(actor.id).then((w) =>
          w ? `/w/${w.id}` : "/w",
        )
      : actor?.type === "guest"
        ? await findDemoWorkspace().then((demo) =>
            demo ? `/w/${demo.id}` : "/w",
          )
        : "/w";

  return (
    <header className="border-border/60 border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-4"
      >
        <Link
          href="/"
          className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          <Image
            src="/citeseek-logo.png"
            alt="CiteSeek"
            width={405}
            height={120}
            className="h-6 w-auto rounded-sm bg-white"
            priority
          />
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
            <HeaderNavLink href={workspaceHref}>
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
