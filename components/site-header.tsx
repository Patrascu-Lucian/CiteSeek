import { cookies } from "next/headers";
import { LogOut } from "lucide-react";

import { HomeLink } from "@/components/home-link";
import { MainNav } from "@/components/main-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { leaveDemoAction, signOutAction } from "@/lib/auth/actions";
import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";
import { findPersonalWorkspace } from "@/lib/workspaces/personal";
import { THEME_COOKIE_NAME, type Theme, isTheme } from "@/lib/theme/theme";

/**
 * Header for every route. Account deletion lives on `/account` — an irreversible
 * action does not belong one click from a wordmark. Ending a session stays here.
 */
export async function SiteHeader() {
  const actor = await getActor();

  // Read here so the toggle stays a pure function of its props.
  const storedTheme = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const theme: Theme = isTheme(storedTheme) ? storedTheme : "system";

  /*
    Resolved here so the link points at `/w/<id>` directly. `/w` is a redirecting
    route handler, and a 307 is a full page navigation — the router never
    commits, so `loading.tsx` never renders and the old page just sits there
    through two cold starts.

    A read, never a write: creating a workspace stays in `/w`, which is what a
    reader without one still falls back to, paying the redirect once.
  */
  const workspaceId =
    actor?.type === "user"
      ? await findPersonalWorkspace(actor.id).then((w) => w?.id ?? null)
      : actor?.type === "guest"
        ? await findDemoWorkspace().then((demo) => demo?.id ?? null)
        : null;

  const workspaceHref = workspaceId ? `/w/${workspaceId}` : "/w";

  /*
    Usage is per-workspace, so it only appears once the id is in hand — omitted
    rather than pointed at `/w`, since a nav item resolving somewhere unrelated
    is worse than an absent one.
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
    Two operations behind one affordance: a user has a session row to delete, a
    guest only a cookie. Rendered in both the header row and the sheet — a
    session with no visible exit is a trap on a shared machine. The label itself
    is sheet-only: an email is unbounded, and `/account` already states it.
  */
  const sessionLabel =
    actor?.type === "user"
      ? (actor.email ?? actor.name ?? "Signed in")
      : "Guest session";

  const sessionExit = actor ? (
    <form action={actor.type === "user" ? signOutAction : leaveDemoAction}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut aria-hidden="true" className="size-4" />
        {actor.type === "user" ? "Sign out" : "Leave demo"}
      </Button>
    </form>
  ) : null;

  return (
    <header className="border-border/60 border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-4"
      >
        {/*
          Full header height like the nav links, so the space around the wordmark
          is clickable. No fill: a logo is a destination, not a tab.
        */}
        <HomeLink className="focus-visible:ring-ring -my-4 inline-flex shrink-0 items-center gap-1 self-stretch focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset">
          {/* Text, so it follows the theme with no second asset — and because the
            placeholder image read "LOGO", leaving the product unnamed here. */}
          <span className="font-wordmark text-lg tracking-wide">CiteSeek</span>
        </HomeLink>

        {/*
          Only for someone with somewhere to go — for an anonymous visitor these
          links are a redirect to sign-in dressed as a destination. No separate
          "Demo" tab: for a guest it resolves to the same page as Workspace.
        */}
        {actor ? (
          <MainNav
            items={items}
            trailing={<ThemeToggle current={theme} />}
            sessionLabel={sessionLabel}
          >
            {sessionExit}
          </MainNav>
        ) : (
          // The theme control is not gated on having an account.
          <div className="ml-auto flex items-center">
            <ThemeToggle current={theme} />
          </div>
        )}
      </nav>
    </header>
  );
}
