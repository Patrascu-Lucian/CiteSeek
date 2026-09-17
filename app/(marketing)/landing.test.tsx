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
    expect(screen.getByText(/no account\. no card\./i)).toBeInTheDocument();
  });

  it("names the cost as the demo link's description, not only beside it", () => {
    // A reader moving by links hears the label alone, and the sentence under the
    // button is what says the demo costs nothing.
    render(<Landing {...anonymous} />);

    expect(
      screen.getByRole("link", { name: /try the demo/i }),
    ).toHaveAccessibleDescription(/no account/i);
  });

  it("renders no cost line for a reader whose calls to action carry none", () => {
    render(
      <Landing primary={anonymous.primary} secondary={anonymous.secondary} />,
    );

    expect(screen.queryByText(/no account/i)).not.toBeInTheDocument();
  });

  it("opens on the claim, not on a category label", () => {
    render(<Landing {...anonymous} />);

    const hero = screen.getAllByRole("heading", { level: 1 })[0]!
      .parentElement!;
    expect(hero.firstElementChild!.tagName).toBe("H1");
  });

  it("offers a sign-in path, named for what signing in adds", () => {
    render(<Landing {...anonymous} />);

    expect(
      screen.getByRole("link", { name: /sign in to upload your own/i }),
    ).toHaveAttribute("href", "/sign-in");
  });

  it("claims only the guarantee that holds on every branch", () => {
    // "A refusal cannot cite" is true where no model runs and false where one
    // does: `eval:refusals` measures model-written refusals carrying markers.
    // An unresolvable marker rendering as plain text is true everywhere.
    render(<Landing {...anonymous} />);

    expect(
      screen.getByText(/a citation cannot be invented/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/a refusal cannot cite/i),
    ).not.toBeInTheDocument();
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
