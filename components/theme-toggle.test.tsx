import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "./theme-toggle";

vi.mock("@/lib/theme/actions", () => ({ setThemeAction: vi.fn() }));

describe("the theme toggle", () => {
  it("says the choice is kept in a cookie, and for how long", () => {
    render(<ThemeToggle current="system" />);

    expect(
      screen.getByRole("group", { name: "Color theme" }),
    ).toHaveAccessibleDescription("Remembered in a cookie for a year.");
  });
});
