import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { callsToAction } from "./calls-to-action";
import { Landing } from "./landing";

const anonymous = callsToAction(null);

describe("Landing", () => {
  it("states what the product does in a single top-level heading", () => {
    render(<Landing {...anonymous} />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(/ask your documents/i);
  });

  it("offers a no-signup path so an evaluator can try it without an account", () => {
    render(<Landing {...anonymous} />);

    const demoLink = screen.getByRole("link", { name: /try the demo/i });
    expect(demoLink).toHaveAttribute("href", "/demo");
  });

  it("offers a sign-in path", () => {
    render(<Landing {...anonymous} />);

    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("lists the feature cards inside a list for screen-reader navigation", () => {
    render(<Landing {...anonymous} />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("labels the feature section rather than leaving it anonymous", () => {
    render(<Landing {...anonymous} />);

    expect(
      screen.getByRole("region", { name: /what citeseek does/i }),
    ).toBeInTheDocument();
  });
});

describe("the hero graphic", () => {
  // It restates the heading. Announced, a screen reader hears the claim twice.
  it("is decorative rather than described", () => {
    const { container } = render(
      <Landing
        primary={{ href: "/sign-in", label: "Get started" }}
        secondary={{ href: "/demo", label: "Try the demo" }}
      />,
    );

    const svg = container.querySelector("svg[role='presentation']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });
});
