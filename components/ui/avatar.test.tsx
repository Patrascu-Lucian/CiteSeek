import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Avatar } from "./avatar";

const initials = (name: string | null, email: string | null) =>
  render(<Avatar name={name} email={email} />).container.textContent;

describe("the account avatar", () => {
  it("takes two initials from a name", () => {
    expect(initials("Ada Lovelace", "ada@example.com")).toBe("AL");
  });

  it("falls back to the address when no provider supplied a name", () => {
    // What an email-link reader is: they typed an address and nothing else.
    expect(initials(null, "ada.lovelace@example.com")).toBe("AL");
  });

  it("splits a local part on its separators rather than reading it as one word", () => {
    expect(initials(null, "ada_lovelace@example.com")).toBe("AL");
    expect(initials(null, "ada-lovelace@example.com")).toBe("AL");
  });

  it("takes the first two only, however many there are", () => {
    expect(initials("Augusta Ada King Noel", null)).toBe("AA");
  });

  it("counts a character, not a code unit", () => {
    // `charAt(0)` splits an astral pair and renders half a character.
    expect(initials("🜁 Alchemy", null)).toBe("🜁A");
  });

  it("draws a glyph when it has neither", () => {
    const { container } = render(<Avatar name={null} email={null} />);

    expect(container.textContent).toBe("");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("stays out of the accessibility tree, because the name is beside it", () => {
    const { container } = render(<Avatar name="Ada Lovelace" email={null} />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
