import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountView } from "./account-view";
import AccountLoading from "./loading";

// Same stubs as `account-view.test.tsx`, and for the same reasons: server
// actions cannot run in jsdom, and the delete dialog wants a router.
vi.mock("@/lib/auth/actions", () => ({
  signOutAction: vi.fn(),
  leaveDemoAction: vi.fn(),
  linkProviderAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const cardsIn = (markup: React.ReactElement) =>
  render(markup).container.querySelectorAll('[data-slot="card"]').length;

describe("the account skeleton", () => {
  it("reserves as many cards as a signed-in reader gets", () => {
    // It claimed to reserve the real layout while reserving two of four, and
    // nothing compared them. Counting both is the only way that claim stays
    // true when a card is added — which is how it went wrong.
    expect(cardsIn(<AccountLoading />)).toBe(
      cardsIn(
        <AccountView
          kind="user"
          name="Ada Lovelace"
          email="ada@example.com"
          providers={["GitHub"]}
          linkable={[{ id: "google", label: "Google" }]}
        />,
      ),
    );
  });

  it("reserves the face the details card now opens with", () => {
    const { container } = render(<AccountLoading />);

    expect(container.querySelector(".rounded-full")).not.toBeNull();
  });

  it("says it is busy, and says so to a screen reader too", () => {
    const { container, getByRole } = render(<AccountLoading />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(getByRole("status")).toHaveTextContent(/loading your account/i);
  });
});
