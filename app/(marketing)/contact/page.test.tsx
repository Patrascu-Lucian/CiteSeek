import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { REPOSITORY_URL } from "@/lib/links";

import ContactPage from "./page";

/**
 * The page a policy points at, so what it names has to be checked rather than
 * assumed present — it holds no address of its own yet.
 */
describe("the contact page", () => {
  it("names a route that actually reaches somebody", () => {
    render(<ContactPage />);

    expect(
      screen.getByRole("link", { name: /the repository/i }),
    ).toHaveAttribute("href", REPOSITORY_URL);
  });

  it("says deletion needs no request at all", () => {
    // The fastest answer to the question this page exists for, and the only one
    // that does not depend on somebody reading a message.
    render(<ContactPage />);

    expect(screen.getByRole("link", { name: /account page/i })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByText(/no copy is kept/i)).toBeInTheDocument();
  });

  it("says local mode's documents are beyond any request", () => {
    render(<ContactPage />);

    expect(screen.getByText(/never reached a server/i)).toBeInTheDocument();
  });

  it("carries the landmark the skip link points at", () => {
    // Every route has to, or "Skip to main content" lands nowhere. The two
    // pages beside this one pin it; this one shipped without.
    const { container } = render(<ContactPage />);

    expect(container.querySelector("main#main")).not.toBeNull();
  });
});
