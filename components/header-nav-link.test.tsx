import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HeaderNavLink } from "./header-nav-link";

const path = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => path.value }));

beforeEach(() => {
  path.value = "/";
});

function link(name: RegExp | string) {
  return screen.getByRole("link", { name });
}

describe("HeaderNavLink", () => {
  it("marks the page you are on", () => {
    path.value = "/account";
    render(<HeaderNavLink href="/account">Account</HeaderNavLink>);

    // The attribute is the point, not the underline. Styling alone would leave
    // "which page am I on" as visual-only information.
    expect(link(/account/i)).toHaveAttribute("aria-current", "page");
  });

  it("leaves other destinations unmarked", () => {
    path.value = "/account";
    render(<HeaderNavLink href="/w">Workspace</HeaderNavLink>);

    expect(link(/workspace/i)).not.toHaveAttribute("aria-current");
  });

  it("stays marked on a nested route", () => {
    // `/w` has to remain current while reading `/w/<id>` — and later
    // `/w/<id>/c/<id>`, once conversations are addressable.
    path.value = "/w/abc-123";
    render(<HeaderNavLink href="/w">Workspace</HeaderNavLink>);

    expect(link(/workspace/i)).toHaveAttribute("aria-current", "page");
  });

  it("does not treat every route as home", () => {
    // A prefix match on "/" would make the wordmark current everywhere.
    path.value = "/account";
    render(<HeaderNavLink href="/">Home</HeaderNavLink>);

    expect(link(/home/i)).not.toHaveAttribute("aria-current");
  });

  describe("the excluded workspace", () => {
    /**
     * `/w` covers *every* workspace, the shared demo included. For a signed-in
     * reader the nav would otherwise underline "Workspace" while they are
     * reading one that is not theirs — a claim the page itself contradicts,
     * since it is headed "CiteSeek Demo" and badged read-only.
     */
    it("unmarks the link while reading the excluded workspace", () => {
      path.value = "/w/demo-id";
      render(
        <HeaderNavLink href="/w" excludes="/w/demo-id">
          Workspace
        </HeaderNavLink>,
      );

      expect(link(/workspace/i)).not.toHaveAttribute("aria-current");
    });

    it("still marks the link on the reader's own workspace", () => {
      path.value = "/w/mine-id";
      render(
        <HeaderNavLink href="/w" excludes="/w/demo-id">
          Workspace
        </HeaderNavLink>,
      );

      expect(link(/workspace/i)).toHaveAttribute("aria-current", "page");
    });

    it("excludes routes nested under the excluded workspace too", () => {
      // A conversation inside the demo is still not your workspace.
      path.value = "/w/demo-id/c/chat-1";
      render(
        <HeaderNavLink href="/w" excludes="/w/demo-id">
          Workspace
        </HeaderNavLink>,
      );

      expect(link(/workspace/i)).not.toHaveAttribute("aria-current");
    });

    it("marks normally when nothing is excluded", () => {
      // A guest passes no exclusion: the demo *is* their workspace, so marking
      // it is correct rather than a lie.
      path.value = "/w/demo-id";
      render(<HeaderNavLink href="/w">Demo workspace</HeaderNavLink>);

      expect(link(/demo workspace/i)).toHaveAttribute("aria-current", "page");
    });
  });
});
