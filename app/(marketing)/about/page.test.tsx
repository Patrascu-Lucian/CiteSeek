import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooter } from "@/components/site-footer";
import { REPOSITORY_URL } from "@/lib/links";

import AboutPage from "./page";

/**
 * This page exists because a stranger on the live URL cannot read the README.
 * The tests pin the claims that would be *wrong* if the system changed —
 * not the prose.
 */
describe("the about page", () => {
  it("states the guarantee that makes the project worth explaining", () => {
    // The model is never called when nothing clears the relevance floor
    // (ADR 011). If that ever stops being true, this sentence becomes a lie.
    render(<AboutPage />);

    expect(
      screen.getByText(/the model is never called at all/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/cites nothing/i)).toBeInTheDocument();
  });

  it("links the source through the shared constant", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("link", { name: /read the source/i }),
    ).toHaveAttribute("href", REPOSITORY_URL);
  });

  it("sends a reader to the privacy page rather than restating it", () => {
    render(<AboutPage />);

    expect(screen.getByRole("link", { name: /privacy page/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("quotes no measurements", () => {
    /*
      Numbers live in the README. Two copies of a measurement is one copy that
      goes stale, and this project has already had to correct a published
      number once.
    */
    const { container } = render(<AboutPage />);

    expect(container.textContent).not.toMatch(/\d+\s*(ms|KB|MB|%)/i);
  });

  it("carries the landmark the skip link points at", () => {
    const { container } = render(<AboutPage />);

    expect(container.querySelector("main#main")).not.toBeNull();
  });
});

describe("the footer's link group", () => {
  it("offers About on every page", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
  });

  it("is named for what it actually contains", () => {
    // "Policies" stopped describing this group once Contact joined it, and
    // About would have made it plainly wrong. Local mode stayed out of it for
    // the same reason: a route the reader can use is not a page about the
    // project, so it sits in its own row rather than widening this name again.
    render(<SiteFooter />);

    const nav = screen.getByRole("navigation", { name: /about this project/i });

    expect(nav).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /^policies$/i }),
    ).toBeNull();
    expect(
      nav.querySelector('a[href="/local"]'),
      "local mode belongs outside this landmark",
    ).toBeNull();
  });
});
