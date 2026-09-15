import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteFooter } from "./site-footer";

afterEach(() => {
  delete process.env.MAINTENANCE;
});

describe("the site footer", () => {
  it("links the project's pages while the site is up", () => {
    render(<SiteFooter />);

    expect(
      screen.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy");
  });

  it("links nothing while the site is held down, because every route answers the holding page", () => {
    process.env.MAINTENANCE = "on";
    render(<SiteFooter />);

    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Lucian Patrascu",
    );
  });
});
