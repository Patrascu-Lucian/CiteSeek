import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
    // The free tier costs nothing, so any currency here would be a number for a
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
