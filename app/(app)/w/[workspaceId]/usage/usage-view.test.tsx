import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlanUsage } from "@/lib/limits/usage";
import type { WorkspaceUsage } from "@/lib/usage/dashboard";

import { UsageView } from "./usage-view";

function usage(overrides: Partial<WorkspaceUsage> = {}): WorkspaceUsage {
  return {
    days: [
      { day: "2026-07-31", requests: 12, inputTokens: 3400, outputTokens: 900 },
      { day: "2026-07-30", requests: 4, inputTokens: 1100, outputTokens: 250 },
    ],
    totals: { requests: 16, inputTokens: 4500, outputTokens: 1150 },
    lastRecordedAt: new Date("2026-07-31T14:05:00.000Z"),
    windowDays: 30,
    ...overrides,
  };
}

const empty = usage({
  days: [],
  totals: { requests: 0, inputTokens: 0, outputTokens: 0 },
  lastRecordedAt: null,
});

describe("UsageView — with usage recorded", () => {
  it("totals the window across every day", () => {
    render(<UsageView workspaceId="w1" usage={usage()} canUpload />);

    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("4,500")).toBeInTheDocument();
    expect(screen.getByText("1,150")).toBeInTheDocument();
  });

  it("says how long the window is, and why it is that long", () => {
    // The retention policy is the hard bound. Without saying so, a reader would
    // read a pruned month as a quiet one.
    render(<UsageView workspaceId="w1" usage={usage()} canUpload />);

    expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
    expect(screen.getByText(/older ones are\s+deleted/i)).toBeInTheDocument();
  });

  it("lists days newest first, in a real table", () => {
    render(<UsageView workspaceId="w1" usage={usage()} canUpload />);

    const rows = within(screen.getByRole("table")).getAllByRole("row");
    // Header plus two days.
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent("2026-07-31");
    expect(rows[2]).toHaveTextContent("2026-07-30");
  });

  it("labels the day column as UTC, since that is what it groups by", () => {
    render(<UsageView workspaceId="w1" usage={usage()} canUpload />);

    expect(
      screen.getByRole("columnheader", { name: /day \(utc\)/i }),
    ).toBeInTheDocument();
  });

  it("shows tokens and never a money figure", () => {
    // Any currency here would be a rate this page invented rather than one it
    // measured, so it stays out — a number for a
    // tier the app is not on — the same failure as the bundle claim the README
    // had to correct.
    const { container } = render(
      <UsageView workspaceId="w1" usage={usage()} canUpload />,
    );

    expect(container.textContent).not.toMatch(/[$€£]/);
    expect(container.textContent).not.toMatch(/\bcost\b/i);
    expect(screen.getByText(/input tokens/i)).toBeInTheDocument();
  });

  it("reports when usage was last written down, and what a stale date means", () => {
    // `recordUsage` swallows its own failures by design and returns a flag
    // nothing consumed. This timestamp is the only visible sign that recording
    // — and therefore every limit depending on it — has stopped.
    render(<UsageView workspaceId="w1" usage={usage()} canUpload />);

    expect(screen.getByText(/2026-07-31 14:05 UTC/)).toBeInTheDocument();
    expect(screen.getByText(/limits that depend on it/i)).toBeInTheDocument();
  });
});

describe("UsageView — with nothing recorded", () => {
  it("explains the empty state rather than drawing an empty table", () => {
    // The common case for a new account, not an edge case.
    render(<UsageView workspaceId="w1" usage={empty} canUpload />);

    expect(
      screen.getByRole("heading", { level: 2, name: /nothing recorded yet/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("tells a reader who can upload how usage gets generated", () => {
    render(<UsageView workspaceId="w1" usage={empty} canUpload />);

    expect(
      screen.getByText(/asking a question or uploading/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to the workspace/i }),
    ).toHaveAttribute("href", "/w/w1");
  });

  it("tells a read-only visitor that nothing they do is charged here", () => {
    // Offering "ask a question to generate usage" to someone who cannot would be
    // an instruction they are unable to follow.
    render(<UsageView workspaceId="w1" usage={empty} canUpload={false} />);

    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

function plan(overrides: Partial<PlanUsage> = {}): PlanUsage {
  return {
    documents: { used: 2, limit: 3 },
    conversations: { used: 1, limit: 3 },
    storage: { used: 180_000, limit: 500_000 },
    ...overrides,
  };
}

describe("UsageView — the plan ceiling", () => {
  it("states what is used against what is allowed", () => {
    render(
      <UsageView workspaceId="w1" usage={usage()} canUpload plan={plan()} />,
    );

    const section = screen.getByRole("region", { name: /plan/i });
    expect(within(section).getByText("2 of 3")).toBeInTheDocument();
    expect(within(section).getByText("180k of 500k")).toBeInTheDocument();
  });

  /* Two limits set independently, and the reader meets the smaller one first: a
     300,000-character upload fails at chunking and never reaches this bar, so
     "500k" on its own reads as something one document could fill. */
  it("says one document cannot fill the storage it shows", () => {
    render(
      <UsageView workspaceId="w1" usage={usage()} canUpload plan={plan()} />,
    );

    const section = screen.getByRole("region", { name: /plan/i });
    const note = within(section).getByText(/each document is capped at/i);

    // The passage count is the rule; the character figure is derived from a
    // measured density and reads as a typical size on its own.
    expect(note).toHaveTextContent("600 passages");
    expect(note).toHaveTextContent("273k");
  });

  /* The demo is read-only for everyone, so a ceiling there would describe a
     limit nobody in that workspace can reach. */
  it("is absent where no cap can bite", () => {
    render(<UsageView workspaceId="w1" usage={usage()} canUpload={false} />);

    expect(screen.queryByRole("region", { name: /plan/i })).toBeNull();
  });

  // A workspace can hold documents and have asked nothing, and that is exactly
  // the reader who benefits from seeing the ceiling early.
  it("shows even when nothing has been spent", () => {
    render(
      <UsageView workspaceId="w1" usage={empty} canUpload plan={plan()} />,
    );

    expect(screen.getByRole("region", { name: /plan/i })).toBeInTheDocument();
    expect(screen.getByText(/Nothing recorded yet/)).toBeInTheDocument();
  });

  it("does not draw a bar past full when a race has overshot", () => {
    const { container } = render(
      <UsageView
        workspaceId="w1"
        usage={usage()}
        canUpload
        plan={plan({ documents: { used: 4, limit: 3 } })}
      />,
    );

    const widths = [...container.querySelectorAll<HTMLElement>("[style]")]
      .map((node) => node.style.width)
      .filter((width) => width.endsWith("%"));

    expect(widths).toContain("100%");
  });
});

describe("the plan figures", () => {
  // Small counts read worse abbreviated: "2 of 3" beats any rounding of it.
  it("leaves countable axes exact", () => {
    render(
      <UsageView
        workspaceId="w1"
        usage={usage()}
        canUpload
        plan={plan({ documents: { used: 2, limit: 3 } })}
      />,
    );

    const section = screen.getByRole("region", { name: /plan/i });
    expect(within(section).getByText("2 of 3")).toBeInTheDocument();
  });

  it("shortens character counts, which would otherwise wrap the row", () => {
    render(
      <UsageView
        workspaceId="w1"
        usage={usage()}
        canUpload
        plan={plan({ storage: { used: 1_250_000, limit: 2_000_000 } })}
      />,
    );

    const section = screen.getByRole("region", { name: /plan/i });
    expect(within(section).getByText("1.3M of 2.0M")).toBeInTheDocument();
  });
});
