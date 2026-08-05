import { cookies } from "next/headers";
import { LogOut } from "lucide-react";

import { HEADER_CONTROL_HEIGHT } from "@/components/header-control-height";
import { HomeLink } from "@/components/home-link";
import { MainNav } from "@/components/main-nav";
import { SignInLink } from "@/components/sign-in-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { getActor } from "@/lib/auth/actor";
import { findDemoWorkspace } from "@/lib/auth/demo";
import { findPersonalWorkspace } from "@/lib/workspaces/personal";
import { THEME_COOKIE_NAME, type Theme, isTheme } from "@/lib/theme/theme";

/**
 * Header for every route. Account deletion lives on `/account` — an irreversible
 * action does not belong one click from a wordmark.
 */
export async function SiteHeader() {
  const actor = await getActor();

  // Read here so the toggle stays a pure function of its props.
  const storedTheme = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const theme: Theme = isTheme(storedTheme) ? storedTheme : "system";

  /*
    Resolved here so the link points at `/w/<id>` directly: `/w` redirects, and a
    307 is a full navigation, so `loading.tsx` never renders. A read, never a
    write — creating a workspace stays in `/w`, which a reader without one still
    falls back to.
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
    Sheet-only: an email is unbounded, and it crowded the horizontal row to say
    what `/account` already states.
  */
  const sessionLabel =
    actor?.type === "user"
      ? (actor.email ?? actor.name ?? "Signed in")
      : "Guest session";

  /*
    A user gets an exit — a session left on a shared machine exposes their
    documents. A guest gets the way *in*: theirs is read access to a public demo
    with no row behind it, so abandoning it exposes nothing. Their exit is on
    `/account`.
  */
  const sessionExit =
    actor?.type === "user" ? (
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className={HEADER_CONTROL_HEIGHT}
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </Button>
      </form>
    ) : (
      <SignInLink />
    );

  return (
    <header className="border-border/60 border-b">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl items-center gap-4 px-3 py-4 sm:px-6"
      >
        {/*
          Full header height like the nav links, so the space around the wordmark
          is clickable. No fill: a logo is a destination, not a tab.
        */}
        <HomeLink className="focus-visible:ring-ring -my-4 inline-flex shrink-0 items-center gap-1 self-stretch focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset">
          {/* Text, so it follows the theme with no second asset — and because the
            placeholder image read "LOGO", leaving the product unnamed here. */}
          <span className="text-primary font-wordmark text-lg tracking-wide">
            CiteSeek
          </span>
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
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle current={theme} />
            <SignInLink />
          </div>
        )}
      </nav>
    </header>
  );
}
