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

  describe("a link pointing at one specific workspace", () => {
    /**
     * The header links straight to `/w/<id>` rather than to `/w`, so that a
     * click is a client-side transition rather than a redirect through a route
     * handler. That also removed a special case: a link to `/w` was a prefix of
     * *every* workspace, so a signed-in reader browsing the shared demo saw
     * "Workspace" marked as current while the page said otherwise.
     */
    it("does not mark a different workspace as current", () => {
      path.value = "/w/demo-id";
      render(<HeaderNavLink href="/w/mine-id">Workspace</HeaderNavLink>);

      expect(link(/workspace/i)).not.toHaveAttribute("aria-current");
    });

    it("marks the reader's own workspace", () => {
      path.value = "/w/mine-id";
      render(<HeaderNavLink href="/w/mine-id">Workspace</HeaderNavLink>);

      expect(link(/workspace/i)).toHaveAttribute("aria-current", "page");
    });

    it("stays marked inside a conversation in that workspace", () => {
      path.value = "/w/mine-id/c/chat-1";
      render(<HeaderNavLink href="/w/mine-id">Workspace</HeaderNavLink>);

      expect(link(/workspace/i)).toHaveAttribute("aria-current", "page");
    });

    it("marks the demo for a guest, whose workspace it is", () => {
      path.value = "/w/demo-id";
      render(<HeaderNavLink href="/w/demo-id">Demo workspace</HeaderNavLink>);

      expect(link(/demo workspace/i)).toHaveAttribute("aria-current", "page");
    });
  });
});
