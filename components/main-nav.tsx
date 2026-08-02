"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { HeaderNavLink } from "@/components/header-nav-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type NavItem = { href: string; label: string };

/**
 * The header's destinations, at both sizes.
 *
 * **Why current-page detection lives here and not in the link.** Each link used
 * to decide for itself by prefix-matching the pathname, which worked while no
 * destination was inside another. Adding Usage broke that: `/w/<id>/usage`
 * starts with `/w/<id>`, so both links marked themselves as the current page and
 * a screen reader announced "current page" twice. Only the container knows every
 * href, so only the container can pick the **longest** match — which is the rule
 * a reader already assumes.
 *
 * Prefix matching is still what is wanted within a destination: reading a
 * conversation at `/w/<id>/c/<chatId>` should keep Workspace marked, because
 * that is where the reader is.
 *
 * **Why a sheet below `md`.** The links, the session email and the sign-out
 * control shared one row, and the row won: the wordmark is an image, so the
 * browser resolved the overflow by shrinking it rather than wrapping. A logo
 * that changes size depending on how long your email address is looks broken,
 * and the real problem is four destinations in a row that has room for two.
 */
export function MainNav({
  items,
  children,
  trailing,
}: {
  items: readonly NavItem[];
  /**
   * The session's exit, rendered inside the sheet on small screens.
   *
   * A Server Component passed through as children rather than rebuilt here: the
   * sign-out and leave-demo forms post to server actions, and which of the two
   * applies depends on the actor, which this component has no business knowing.
   */
  children?: React.ReactNode;
  /**
   * Sits in the header row at every size, outside the sheet. The theme control
   * goes here: it is not a destination, and a preference worth changing is worth
   * reaching in one tap.
   */
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* The same links twice, rather than one list moved by CSS: the mobile
          copy needs to close the sheet on navigation, which the desktop copy
          must not do. */}
      <div className="hidden items-center gap-4 md:flex">
        {items.map((item) => (
          <HeaderNavLink key={item.href} href={item.href} items={items}>
            {item.label}
          </HeaderNavLink>
        ))}
      </div>

      {/*
        One owner for the right-hand side of the row. The theme control sits at
        every size — it is not a destination, so hiding it behind the menu would
        make a two-tap job of a one-tap one — while the session's identity and
        exit move into the sheet below `md`, where the row has no space for them.
      */}
      <div className="ml-auto flex items-center gap-2">
        {trailing}

        {children ? (
          <div className="hidden items-center gap-3 md:flex">{children}</div>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          // The label moves to `aria-label` rather than disappearing. A button
          // whose only content is a decorative icon has no accessible name at
          // all, which makes it unreachable by screen reader and by name-based
          // queries — the hamburger is a convention to sighted readers only.
          aria-label="Menu"
          aria-expanded={open}
          // No `aria-controls`: the sheet's markup does not exist until it
          // opens, so the id would dangle for as long as the button is useful.
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        {/*
          `aria-describedby={undefined}` because there is no description. Radix
          points a dialog at one by default and warns when it finds nothing;
          saying so explicitly is the supported way to have a dialog whose title
          is enough on its own.
        */}
        <SheetContent className="w-72" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          {/* Unlabelled: the header row already owns the "Main" navigation landmark,
              and two landmarks with the same name is worse than one with none.
              The sheet title above says what this is. */}
          <nav className="flex flex-col gap-1 px-4">
            {items.map((item) => (
              <HeaderNavLink
                key={item.href}
                href={item.href}
                items={items}
                className="rounded-md px-2 py-2 text-base"
                // Tapping a link inside an open sheet navigates behind it, and
                // the sheet would still be covering the page it navigated to.
                onNavigate={() => setOpen(false)}
              >
                {item.label}
              </HeaderNavLink>
            ))}
          </nav>

          {/*
            A session with no visible exit is a trap on a shared machine, and
            hiding the control below `md` would have made that true on exactly
            the devices most likely to be shared.

            The two child selectors are doing real work. This block is the header
            row's markup reused vertically, and its parts carry insets meant for
            a horizontal row: the email is a bare span with none, and the button
            brings the `px-3` every button here has. Stacked under links that sit
            at `px-2`, that reads as three different left edges. Normalizing them
            here keeps the alignment with the thing it has to line up against,
            rather than pushing layout choices into the shared markup, where they
            would then be wrong on desktop.
          */}
          {children ? (
            <div className="border-border/60 mt-4 flex flex-col items-start gap-2 border-t px-4 pt-4 [&_button]:px-2 [&>span]:px-2">
              {children}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
