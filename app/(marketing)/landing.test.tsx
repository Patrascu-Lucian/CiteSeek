import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { callsToAction } from "./calls-to-action";
import { Landing } from "./landing";

const anonymous = callsToAction(null);
const root = join(import.meta.dirname, "..", "..");

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
    // an unresolved marker is not a link, and the refusal is not the model's
    // words. Not "the model never runs" — on a follow-up the refusal branch
    // rewrites the question through one before giving up (ADR 044).
    expect(section).toHaveTextContent(/before the model writes a word/i);
    expect(section).toHaveTextContent(/stays plain text/i);
    expect(section).toHaveTextContent(/written by CiteSeek, not by the model/i);
    expect(section).not.toHaveTextContent(/never runs/i);
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

  it("points at local mode", () => {
    /* Only the destination. That it arrives by a document request, which ADR 028
       needs for the route's own CSP, is pinned in `a11y.spec.ts`: a `next/link`
       renders as a bare anchor here, so nothing in jsdom can tell the two apart.
       The assertion that used to stand in for it — no `data-prefetch` attribute —
       passed for a `Link` too, because nothing emits that attribute. */
    render(<Landing {...anonymous} />);

    expect(
      screen.getByRole("link", { name: /says what it measures/i }),
    ).toHaveAttribute("href", "/local");
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

  it("describes the product in whichever palette is showing", () => {
    // Two here because jsdom applies no CSS. In a browser `display: none` keeps
    // the hidden one out of the accessibility tree, so only one is announced.
    render(<Landing {...anonymous} />);

    const how = screen.getByRole("region", {
      name: /how a question is answered/i,
    });
    const shots = within(how).getAllByRole("img");

    expect(shots).toHaveLength(2);
    for (const shot of shots) {
      expect(shot).toHaveAccessibleName(/source panel open/i);
    }
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

describe("the screenshot's declared size", () => {
  /* `next/image` reads these from the static import in a build; under Vitest the
     loader returns a URL string, so the page states them by hand. A pair that
     does not match the file stretches the picture and reserves the wrong box. */
  const dimensionsOf = (file: string) => {
    const png = readFileSync(join(root, "docs", "images", file));

    expect(png.subarray(0, 8).toString("hex"), `${file} is not a PNG`).toBe(
      "89504e470d0a1a0a",
    );

    // Width and height open IHDR, which is the first chunk after the signature.
    return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  };

  it("is the size of the files, in both palettes", () => {
    const light = dimensionsOf("source.png");
    expect(dimensionsOf("dark.png")).toEqual(light);

    const { container } = render(<Landing {...anonymous} />);
    const declared = [...container.querySelectorAll("img")].map((img) => ({
      width: Number(img.getAttribute("width")),
      height: Number(img.getAttribute("height")),
    }));

    expect(declared).toEqual([light, light]);
  });

  it("is the viewport the capture script shoots at", () => {
    // `page.screenshot()` takes the viewport at scale 1, so this is what the
    // next `pnpm demo:shots` writes — red on the change, not after a re-shoot.
    const script = readFileSync(
      join(root, "scripts", "build-readme-shots.mts"),
      "utf8",
    );
    const viewport = /const VIEWPORT = \{ width: (\d+), height: (\d+) \}/.exec(
      script,
    );

    expect(
      viewport,
      "no VIEWPORT literal in the capture script",
    ).not.toBeNull();
    expect({
      width: Number(viewport![1]),
      height: Number(viewport![2]),
    }).toEqual(dimensionsOf("source.png"));
  });
});
