import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type * as ReactDomModule from "react-dom";

const status = vi.hoisted(() => ({ pending: false }));

// `useFormStatus` needs a real form submission to report pending, which jsdom
// cannot start — the action is a server action.
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactDomModule>()),
  useFormStatus: () => status,
}));

import { SubmitButton } from "./submit-button";

describe("the sign-in button", () => {
  it("reads as its label until the form is submitted", () => {
    status.pending = false;
    render(<SubmitButton>Continue with GitHub</SubmitButton>);

    const button = screen.getByRole("button", {
      name: /continue with github/i,
    });

    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });

  it("says where it is taking you, and refuses a second click", () => {
    // The action ends in a redirect to GitHub. Silence here read as a dead
    // button and invited a second submission.
    status.pending = true;
    render(<SubmitButton>Continue with GitHub</SubmitButton>);

    const button = screen.getByRole("button", {
      name: /taking you to github/i,
    });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });
});
