import { readFileSync } from "node:fs";
import { join } from "node:path";

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
      <Landing
        primary={anonymous.primary}
        secondary={anonymous.secondary}
        closing={anonymous.closing}
      />,
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

  it("explains the guarantee in its own section, not in a third of a card row", () => {
    render(<Landing {...anonymous} />);

    const section = screen.getByRole("region", {
      name: /how that guarantee is built/i,
    });

    // The three things that make it structural: the payload precedes the prose,
    // an unresolved marker is not a link, and the refusal branch runs no model.
    expect(section).toHaveTextContent(/before the model writes a word/i);
    expect(section).toHaveTextContent(/stays plain text/i);
    expect(section).toHaveTextContent(/the model never runs/i);
  });

  it("does not promise that a refusal never cites", () => {
    // `eval/refusals.md` measures model-written refusals carrying markers, so
    // that claim is false on the branch where a question clears the floor.
    render(<Landing {...anonymous} />);

    expect(
      screen.queryByText(/a refusal cannot cite/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/never cites/i)).not.toBeInTheDocument();
  });

  it("points at local mode with a document navigation, not a client one", () => {
    // A route-scoped CSP only applies to a document response, so a `Link` here
    // would leave this page's policy governing local mode (ADR 028).
    render(<Landing {...anonymous} />);

    const link = screen.getByRole("link", { name: /says what it measures/i });

    expect(link).toHaveAttribute("href", "/local");
    expect(link).not.toHaveAttribute("data-prefetch");
  });

  it("lists the feature cards inside a list for screen-reader navigation", () => {
    render(<Landing {...anonymous} />);

    const features = screen.getByRole("region", {
      name: /what citeseek does/i,
    });
    const list = within(features).getByRole("list");

    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("walks through how a question is answered, in order", () => {
    render(<Landing {...anonymous} />);

    const how = screen.getByRole("region", {
      name: /how a question is answered/i,
    });
    const steps = within(how).getAllByRole("listitem");

    expect(steps).toHaveLength(3);
    expect(steps[1]).toHaveTextContent(/before the model writes/i);
  });

  it("shows the product, with the dark screenshot hidden from assistive tech", () => {
    // Two files, one view: the `dark:` variant swaps them so a dark page is not
    // shown a light product. Only one of the pair is describable, or a screen
    // reader hears the same picture twice.
    render(<Landing {...anonymous} />);

    const how = screen.getByRole("region", {
      name: /how a question is answered/i,
    });
    const described = within(how).getAllByRole("img");

    expect(described).toHaveLength(1);
    expect(described[0]).toHaveAccessibleName(/source panel open/i);
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
        closing={anonymous.closing}
      />,
    );

    const svg = container.querySelector("svg[role='presentation']");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");

    // Inside the hero only: the screenshot further down is a real image and is
    // described.
    const hero = svg!.closest("section")!;
    expect(within(hero).queryByRole("img")).toBeNull();
  });
});

describe("the strip of measured numbers", () => {
  /* The point of the strip is that every figure on it came from a run. A number
     typed here and nowhere else is the failure mode, so each is looked up in the
     report it was measured by. */
  const root = join(import.meta.dirname, "..", "..");
  const sources = ["README.md", join("eval", "report.md")]
    .map((file) => readFileSync(join(root, file), "utf8"))
    .join("\n");

  const figures = () =>
    within(
      screen.getByRole("region", { name: /what has been measured/i }),
    ).getAllByRole("term");

  it("shows four of them", () => {
    render(<Landing {...anonymous} />);

    expect(figures()).toHaveLength(4);
  });

  it("quotes only numbers a committed report also carries", () => {
    render(<Landing {...anonymous} />);

    const unsupported = figures()
      .map((figure) => figure.textContent)
      .filter((value) => !sources.includes(value));

    expect(unsupported).toEqual([]);
  });

  it("claims no count of readers and no zero for invented citations", () => {
    // `db:usage` says the readers are the author; `eval/refusals.md` measures
    // refusals that do carry a marker, so neither claim would survive its source.
    render(<Landing {...anonymous} />);

    const strip = screen.getByRole("region", {
      name: /what has been measured/i,
    });

    expect(strip).not.toHaveTextContent(/users|readers|visitors/i);
    expect(strip).not.toHaveTextContent(/\b0 (invented|hallucinat)/i);
  });
});

describe("the invitation at the foot", () => {
  it("ends on the reader's own next step, not on a sentence about the project", () => {
    render(<Landing {...anonymous} />);

    const closing = screen.getByRole("region", {
      name: anonymous.closing.heading,
    });

    expect(
      within(closing).getByRole("link", {
        name: anonymous.closing.action.label,
      }),
    ).toHaveAttribute("href", "/demo");
  });

  it("does not repeat the hero's link name lower down the same page", () => {
    // Two links with one accessible name are indistinguishable in a screen
    // reader's link list, and they would void the entry count in `smoke.spec.ts`.
    render(<Landing {...anonymous} />);

    expect(
      screen.getAllByRole("link", { name: anonymous.primary.label }),
    ).toHaveLength(1);
  });
});
