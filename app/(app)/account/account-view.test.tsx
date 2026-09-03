import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountView } from "./account-view";

/**
 * Server Actions cannot run in jsdom — `signOutAction` reaches into Auth.js. The
 * form still renders and is still assertable; only the submission is stubbed.
 */
vi.mock("@/lib/auth/actions", () => ({
  signOutAction: vi.fn(),
  leaveDemoAction: vi.fn(),
  linkProviderAction: vi.fn(),
}));

/**
 * `DeleteAccountDialog` calls `useRouter`, which needs a router jsdom has no
 * way to provide. Same stub shape as `upload-dropzone.test.tsx` — this suite
 * asserts the dialog is *offered*, not what happens after it succeeds.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const user = {
  kind: "user",
  name: "Ada Lovelace",
  email: "ada@example.com",
  providers: ["GitHub"],
  linkable: [{ id: "google", label: "Google" }],
} as const;

describe("AccountView — a signed-in user", () => {
  it("shows the details someone would come here to check", () => {
    render(<AccountView {...user} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
  });

  it("says a field is absent rather than rendering a blank row", () => {
    // GitHub accounts can withhold both. A silent empty cell reads as a bug in
    // the page rather than as an absent value.
    render(
      <AccountView
        kind="user"
        name={null}
        email={null}
        providers={[]}
        linkable={[]}
      />,
    );

    expect(screen.getAllByText(/not provided/i)).toHaveLength(3);
  });

  it("offers both exits, and only one of them is destructive", () => {
    render(<AccountView {...user} />);

    expect(
      screen.getByRole("button", { name: /sign out/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete (your )?account/i }),
    ).toBeInTheDocument();
  });

  it("explains what deletion destroys before it is triggered", () => {
    // The reason this page exists. The header offered the same action with no
    // room to say what it does, which is what made it the wrong home for it.
    render(<AccountView {...user} />);

    const section = screen
      .getByRole("heading", { level: 2, name: /delete your account/i })
      .closest("div")!.parentElement!;

    expect(section).toHaveTextContent(/cannot be undone/i);
    expect(section).toHaveTextContent(/document/i);
    expect(section).toHaveTextContent(/conversation/i);
  });

  it("pairs each label with its value for a screen reader", () => {
    // A description list rather than a table: `dt`/`dd` is what conveys the
    // pairing. Asserted structurally because the visual grid would look
    // identical if the markup were a pile of divs.
    const { container } = render(<AccountView {...user} />);

    // Across every list, not the first one: the sign-in row moved to its own
    // card, and which card holds a pair is not what this is asserting.
    const lists = [...container.querySelectorAll("dl")];

    expect(
      lists.flatMap((list) => within(list).getAllByRole("term")),
    ).toHaveLength(3);
    expect(
      lists.flatMap((list) => within(list).getAllByRole("definition")),
    ).toHaveLength(3);
  });
});

describe("AccountView — a guest", () => {
  it("explains why there is nothing to manage", () => {
    render(<AccountView kind="guest" />);

    expect(
      screen.getByRole("heading", { level: 2, name: /guest session/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/store nothing on the server/i),
    ).toBeInTheDocument();
  });

  it("offers no deletion control at all", () => {
    // Not a disabled button: there is no account, so an affordance that looks
    // like it might work is worse than its absence. `DELETE /api/account`
    // refuses a guest for the same reason.
    render(<AccountView kind="guest" />);

    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("points at the thing that would give them an account", () => {
    render(<AccountView kind="guest" />);

    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("offers a way to end the session", () => {
    // The header gave this up to offer the way *in* instead, so this page is
    // where it has to be — a session with no exit anywhere is the failure.
    render(<AccountView kind="guest" />);

    expect(
      screen.getByRole("button", { name: /leave the demo/i }),
    ).toBeInTheDocument();
  });
});

describe("linking a second provider", () => {
  it("offers the ones not linked yet, and does not re-offer the current one", () => {
    render(<AccountView {...user} />);

    expect(
      screen.getByRole("button", { name: /add google/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add github/i }),
    ).not.toBeInTheDocument();
  });

  it("offers nothing to add once every provider is linked", () => {
    render(
      <AccountView {...user} providers={["GitHub", "Google"]} linkable={[]} />,
    );

    expect(screen.queryByRole("button", { name: /^add /i })).toBeNull();
    expect(screen.getByText("GitHub, Google")).toBeInTheDocument();
  });

  it("says linking attaches to this session, not to a matching email", () => {
    // The reason the card exists rather than the sign-in page adopting an
    // account on a shared address (ADR 051).
    render(<AccountView {...user} />);

    expect(
      screen.getByText(/links it to the session you are in/i),
    ).toBeInTheDocument();
  });
});
