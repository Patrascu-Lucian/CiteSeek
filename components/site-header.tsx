import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";

import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { leaveDemoAction, signOutAction } from "@/lib/auth/actions";
import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";
import { findPersonalWorkspace } from "@/lib/workspaces/personal";
import { THEME_COOKIE_NAME, type Theme, isTheme } from "@/lib/theme/theme";

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

  // Read here rather than inside the toggle so the header stays one round of
  // cookie reads, and so the control is a pure function of its props.
  const storedTheme = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const theme: Theme = isTheme(storedTheme) ? storedTheme : "system";

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
  const workspaceId =
    actor?.type === "user"
      ? await findPersonalWorkspace(actor.id).then((w) => w?.id ?? null)
      : actor?.type === "guest"
        ? await findDemoWorkspace().then((demo) => demo?.id ?? null)
        : null;

  const workspaceHref = workspaceId ? `/w/${workspaceId}` : "/w";

  /*
    Usage is per-workspace, which is why it was not here at first — a link in a
    global header needs a destination on every route, and this one does not exist
    without a workspace.

    It is here now because the header already resolves the workspace above, for
    the redirect reason described there, so the id is in hand and the link costs
    nothing. A page nobody can find is a page nobody reads, and the workspace
    body is not where someone goes looking for "what have I spent".

    Omitted rather than pointed at `/w` when there is no workspace yet: a nav
    item that resolves somewhere unrelated is worse than one that is absent.
  */
  const items = actor
    ? [
        {
          href: workspaceHref,
          label: actor.type === "guest" ? "Demo workspace" : "Workspace",
        },
        ...(workspaceId
          ? [{ href: `/w/${workspaceId}/usage`, label: "Usage" }]
          : []),
        { href: "/account", label: "Account" },
      ]
    : [];

  /*
    Two different operations behind one visual affordance. A signed-in user has a
    session row Auth.js must delete; a guest has only a signed cookie and nothing
    server-side.

    Built once and rendered in both places — the header row above `md`, and the
    sheet below it. A session with no visible exit is a trap on a shared machine,
    which is most true on exactly the devices the sheet exists for.
  */
  const sessionLabel =
    actor?.type === "user"
      ? (actor.email ?? actor.name ?? "Signed in")
      : "Guest session";

  const sessionExit = actor ? (
    <>
      {/*
        Truncated, with the full value on hover.

        An email address has no length limit worth relying on — the local part
        alone may be 64 characters — and this sits in a fixed-width row beside a
        logo that is now explicitly not allowed to give way. Something has to,
        and it should be the part that stays useful when clipped: the beginning
        of an address identifies the account, which is all this label is for.

        `max-w` rather than only `truncate`, because truncation needs a width to
        truncate against: in a flex row the item would otherwise size to its
        content and push everything else instead.
      */}
      <span
        title={sessionLabel}
        className="text-muted-foreground max-w-56 truncate text-sm"
      >
        {sessionLabel}
      </span>

      <form action={actor.type === "user" ? signOutAction : leaveDemoAction}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut aria-hidden="true" className="size-4" />
          {actor.type === "user" ? "Sign out" : "Leave demo"}
        </Button>
      </form>
    </>
  ) : null;

  return (
    <header className="border-border/60 border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-4"
      >
        <Link
          href="/"
          className="focus-visible:ring-ring inline-flex shrink-0 items-center gap-1 rounded-md focus-visible:ring-2 focus-visible:outline-none"
        >
          {/*
            One asset, inverted for dark.

            Vector rather than the raster of the same mark: **942 bytes against
            7.2 KB**, and crisp at any pixel density rather than at exactly one.
            A wordmark is line art, which is what vector formats are for.

            `invert` is exact here rather than a trick, and that is a property of
            this artwork rather than a general rule — every fill in the file is
            the same `#1A1A1A`, so there is no hue for inversion to distort.
            Near-black becomes near-white and nothing else moves. The moment the
            mark carries a brand color this stops being correct and needs either
            two assets or inline SVG driven by `currentColor`.

            `unoptimized` because the optimizer has nothing to do with an SVG —
            there are no pixels to resize or re-encode, so Next serves the file
            as-is either way, and saying so avoids a needless round trip through
            `/_next/image`.
          */}
          <Image
            src="/placeholder-logo.svg"
            alt="CiteSeek"
            width={123}
            height={40}
            className="h-6 w-auto dark:invert"
            unoptimized
            priority
          />
        </Link>

        {/*
          Only for someone who has somewhere to go. An anonymous visitor has no
          workspace and no account, so linking to either would be offering a
          redirect to sign-in dressed up as a destination.

          The workspace link is labeled for who is reading it — see `items`
          above. Deliberately not a separate "Demo" tab: for a guest it would
          resolve to the *same page*, and a signed-in reader already has "Open
          the demo" on the landing page.
        */}
        {actor ? (
          <MainNav items={items} trailing={<ThemeToggle current={theme} />}>
            {sessionExit}
          </MainNav>
        ) : (
          // An anonymous visitor has no destinations and no session, but does
          // have eyes: the theme control is not gated on having an account.
          <div className="ml-auto flex items-center">
            <ThemeToggle current={theme} />
          </div>
        )}
      </nav>
    </header>
  );
}
