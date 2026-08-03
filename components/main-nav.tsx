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
 * Current-page detection lives here rather than in the link: `/w/<id>/usage`
 * starts with `/w/<id>`, so per-link prefix matching announced "current page"
 * twice. Only the container sees every href, so only it can take the longest
 * match — while prefix matching still keeps Workspace marked at `/w/<id>/c/<id>`.
 *
 * The sheet below `md` exists because four destinations in a row with space for
 * two made the browser resolve the overflow by shrinking the wordmark.
 */
export function MainNav({
  items,
  children,
  trailing,
}: {
  items: readonly NavItem[];
  /** Passed through rather than rebuilt: sign-out vs leave-demo depends on the
   * actor, which this does not know. */
  children?: React.ReactNode;
  /** Stays in the header row at every size — not a destination, so it should be
   * one tap rather than two. */
  trailing?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/*
        Two copies rather than one moved by CSS: the sheet copy closes on
        navigation, this one must not.

        `self-stretch -my-4` are coupled — stretching stops at the content box,
        and the negative margin cancels the row's `py-4` so the active fill
        reaches the header's full height.
      */}
      <div className="-my-4 hidden self-stretch md:flex">
        {items.map((item) => (
          <HeaderNavLink key={item.href} href={item.href} items={items}>
            {item.label}
          </HeaderNavLink>
        ))}
      </div>

      {/* Theme stays at every size; the session's identity and exit move into the
        sheet below `md`, where the row has no space for them. */}
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
          aria-label="Menu"
          aria-expanded={open}
          // No `aria-controls`: the sheet's markup does not exist until it opens,
          // so the id would dangle for as long as the button is useful.
          onClick={() => setOpen(true)}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        {/* Radix points a dialog at a description by default and warns when it
          finds none; `undefined` is the supported way to say the title suffices. */}
        <SheetContent className="w-72" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          {/*
            Unlabeled: the row above already owns the "Main" landmark, and two
            with one name is worse than one with none. No padding or gap either —
            the rows are the targets, so their fills run edge to edge and meet.
          */}
          <nav className="my-4 flex flex-col">
            {items.map((item) => (
              <HeaderNavLink
                key={item.href}
                href={item.href}
                items={items}
                // No rounding, because these fills touch. `px-6` matches
                // `SheetHeader`, so all text shares one edge.
                className="w-full px-6 py-3 text-base"
                // Otherwise the sheet stays open over the page it navigated to.
                onNavigate={() => setOpen(false)}
              >
                {item.label}
              </HeaderNavLink>
            ))}
          </nav>

          {/*
            A session with no visible exit is a trap on a shared machine, most of
            all on the devices this sheet exists for.

            The child selectors strip insets meant for a horizontal row — the
            button brings its own `px-3` — so everything here lines up on the
            same left edge as the links. Done here rather than in the shared
            markup, where it would be wrong on desktop.
          */}
          {children ? (
            <div className="border-border/60 flex flex-col items-start gap-2 border-t px-6 pt-4 [&_button]:px-0 [&>span]:px-0">
              {children}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
