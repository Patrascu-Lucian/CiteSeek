import { render, screen } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { describe, expect, it } from "vitest";

import { StatusPage } from "./status-page";

const shell = (children?: React.ReactNode) =>
  render(
    <StatusPage icon={Wrench} title="Nothing here" description="Move along.">
      {children}
    </StatusPage>,
  );

describe("the status page shell", () => {
  it("carries the landmark the skip link points at", () => {
    // Six pages depend on this one file for it now, so it is the single place
    // "Skip to main content" can be broken for all of them at once.
    expect(shell().container.querySelector("main#main")).not.toBeNull();
  });

  it("makes the title the page's h1, not a section heading", () => {
    shell();

    expect(
      screen.getByRole("heading", { level: 1, name: "Nothing here" }),
    ).toBeInTheDocument();
  });

  it("hides the icon, which repeats what the title says", () => {
    const { container } = shell();

    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("omits the content area rather than leaving an empty one", () => {
    // The maintenance page offers no way out on purpose — every route answers
    // it — and an empty `CardContent` would still take its padding.
    expect(shell().container.querySelector('[data-slot="card-content"]')).toBe(
      null,
    );
  });

  it("replaces the default row rather than adding to it", () => {
    // `space-y-4` merged onto `flex flex-wrap gap-3` does nothing: vertical
    // spacing on a horizontal row is a no-op, and the boundaries stack.
    const { container } = render(
      <StatusPage
        icon={Wrench}
        title="Broken"
        description="Sorry."
        contentClassName="space-y-4"
      >
        <p>Try again</p>
      </StatusPage>,
    );

    const content = container.querySelector('[data-slot="card-content"]');
    expect(content).toHaveClass("space-y-4");
    expect(content).not.toHaveClass("flex");
  });
});
