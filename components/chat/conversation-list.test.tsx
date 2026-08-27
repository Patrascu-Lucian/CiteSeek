import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextLink from "next/link";

import { MAX_TITLE_LENGTH } from "@/lib/chats/titles";

import { ConversationList } from "./conversation-list";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** `useLinkStatus` takes no argument, so the fake `<Link>` publishes the href it
 * matches on — without it a stub cannot tell one row from another. */
const opening = vi.hoisted(() => ({ href: null as string | null }));

vi.mock("next/link", async (importOriginal) => {
  const actual = await importOriginal<typeof NextLink>();
  const react = await import("react");
  const Href = react.createContext<string>("");

  return {
    ...actual,
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children?: React.ReactNode;
    } & Record<string, unknown>) =>
      react.createElement(
        Href.Provider,
        { value: href },
        react.createElement("a", { href, ...rest }, children),
      ),
    useLinkStatus: () => ({
      pending: react.useContext(Href) === opening.href,
    }),
  };
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  opening.href = null;
});

/** `userEvent.click` returns nothing, and the event is what is being asserted. */
async function clickAndCapture(element: HTMLElement) {
  let seen: MouseEvent | null = null;
  const capture = (event: MouseEvent) => {
    seen = event;
  };

  element.addEventListener("click", capture);
  await userEvent.click(element);
  element.removeEventListener("click", capture);

  if (seen === null) throw new Error("The click never reached the element.");
  return seen as MouseEvent;
}

/**
 * Deleting is behind a confirmation, so every delete in these tests goes through
 * it. The dialog is part of the behavior now, not scaffolding around it.
 */
async function confirmDelete(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
  await userEvent.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", {
      name: /delete conversation/i,
    }),
  );
}

const chats = [
  {
    id: "chat-1",
    title: "Expenses policy",
    updatedAt: new Date("2026-07-30T10:00:00Z"),
    messageCount: 4,
  },
  {
    id: "chat-2",
    title: null,
    updatedAt: new Date("2026-07-29T10:00:00Z"),
    messageCount: 0,
  },
];

function renderList(activeChatId: string | null = "chat-1") {
  const onChanged = vi.fn();
  const { rerender } = render(
    <ConversationList
      workspaceId="w1"
      chats={chats}
      activeChatId={activeChatId}
      onChanged={onChanged}
    />,
  );

  return {
    onChanged,
    arriveAt: (chatId: string) => {
      opening.href = null;
      rerender(
        <ConversationList
          workspaceId="w1"
          chats={chats}
          activeChatId={chatId}
          onChanged={onChanged}
        />,
      );
    },
  };
}

describe("ConversationList", () => {
  it("explains itself when there is no history yet", () => {
    render(
      <ConversationList
        workspaceId="w1"
        chats={[]}
        activeChatId={null}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText(/will be listed/i)).toBeInTheDocument();
  });

  it("links each conversation to its own URL", () => {
    // Routes rather than client state: a conversation can be linked, bookmarked
    // and reached with the back button.
    renderList();

    expect(
      screen.getByRole("link", { name: /expenses policy/i }),
    ).toHaveAttribute("href", "/w/w1/c/chat-1");
  });

  it("names an untitled conversation rather than rendering a blank row", () => {
    renderList();

    expect(
      screen.getByRole("link", { name: /untitled conversation/i }),
    ).toBeInTheDocument();
  });

  it("marks the open conversation", () => {
    renderList("chat-2");

    expect(
      screen.getByRole("link", { name: /untitled conversation/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: /expenses policy/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks the conversation being opened, and only that one", () => {
    opening.href = "/w/w1/c/chat-2";
    renderList();

    expect(
      screen.getByRole("link", { name: /untitled conversation/i }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("link", { name: /expenses policy/i }),
    ).not.toHaveAttribute("aria-busy");

    // Icons are `aria-hidden`, so the spinner has no accessible name to find it by.
    expect(
      screen
        .getByRole("link", { name: /untitled conversation/i })
        .querySelector(".animate-spin"),
    ).not.toBeNull();
  });

  it("holds the other destinations back while one is opening", () => {
    opening.href = "/w/w1/c/chat-2";
    renderList();

    expect(
      screen.getByRole("link", { name: /expenses policy/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("hands the selected look to the row being opened", () => {
    // Otherwise the row being left keeps it, and two rows read as chosen.
    opening.href = "/w/w1/c/chat-2";
    renderList("chat-1");

    expect(
      screen.getByRole("link", { name: /untitled conversation/i }),
    ).toHaveClass("bg-muted");
    expect(
      screen.getByRole("link", { name: /expenses policy/i }),
    ).not.toHaveClass("bg-muted");
  });

  it("holds the row controls back too", () => {
    opening.href = "/w/w1/c/chat-2";
    renderList();

    expect(
      screen.getByRole("button", { name: "Rename Expenses policy" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Delete Untitled conversation" }),
    ).toBeDisabled();
  });

  it("releases the list once the conversation has opened", () => {
    // A probe rendered only on inactive rows unmounts as its row becomes active.
    opening.href = "/w/w1/c/chat-2";
    const { arriveAt } = renderList("chat-1");

    arriveAt("chat-2");

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-disabled");
    }
    expect(
      screen.getByRole("button", { name: "Rename Expenses policy" }),
    ).toBeEnabled();
  });

  it("leaves every row live when nothing is opening", () => {
    renderList();

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-busy");
      expect(link).not.toHaveAttribute("aria-disabled");
    }
  });

  it("does nothing when the open conversation is clicked again", async () => {
    renderList("chat-2");

    const open = screen.getByRole("link", { name: /untitled conversation/i });
    const click = await clickAndCapture(open);

    expect(click.defaultPrevented).toBe(true);
  });

  it("gives each row's controls a name that says which conversation", () => {
    // "Rename" repeated down a list gives a screen-reader user a column of
    // identical controls with no way to tell them apart.
    renderList();

    expect(
      screen.getByRole("button", { name: "Rename Expenses policy" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete Untitled conversation" }),
    ).toBeInTheDocument();
  });

  it("renames through the API and asks for fresh server data", async () => {
    const { onChanged } = renderList();

    await userEvent.click(
      screen.getByRole("button", { name: "Rename Expenses policy" }),
    );
    const field = screen.getByRole("textbox", { name: /conversation name/i });
    await userEvent.clear(field);
    await userEvent.type(field, "Travel");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/w/w1/chats/chat-1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("leaves the page when the open conversation is deleted", async () => {
    // Deleting what you are reading makes the current URL a 404. Staying there
    // would turn a successful delete into a broken page.
    const { onChanged } = renderList("chat-1");

    await confirmDelete("Delete Expenses policy");

    expect(router.push).toHaveBeenCalledWith("/w/w1");
    expect(onChanged).toHaveBeenCalled();
  });

  it("deletes nothing until the confirmation is accepted", async () => {
    // The reason the dialog exists: the delete button sits beside rename in a
    // dense list, both icon-only, so pressing it is easy to do by accident.
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Expenses policy" }),
    );

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("names the conversation it is about to delete", async () => {
    // A confirmation that does not say which one is about to go does not help
    // with the mistake it exists to catch.
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Expenses policy" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/Expenses policy/);
    expect(dialog).toHaveTextContent(/cannot be undone/i);
  });

  it("keeps the conversation when the confirmation is declined", async () => {
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: "Delete Expenses policy" }),
    );
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: /keep it/i,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Delete Expenses policy" }),
    ).toBeInTheDocument();
  });

  it("stays put when deleting a conversation that is not open", async () => {
    renderList("chat-1");

    await confirmDelete("Delete Untitled conversation");

    expect(router.push).not.toHaveBeenCalled();
  });

  it("says so when a request fails, and does not pretend it worked", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { onChanged } = renderList();

    await confirmDelete("Delete Expenses policy");

    expect(await screen.findByRole("alert")).toHaveTextContent(/didn't work/i);
    expect(onChanged).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("can be cancelled out of a rename with Escape", async () => {
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: "Rename Expenses policy" }),
    );
    await userEvent.keyboard("{Escape}");

    expect(
      screen.queryByRole("textbox", { name: /conversation name/i }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps the rename field at the same limit auto-titling uses", async () => {
    // Shared with `titleFromQuestion`, so a renamed chat and an auto-titled one
    // cannot disagree about how long a title may be.
    renderList();

    await userEvent.click(
      screen.getByRole("button", { name: "Rename Expenses policy" }),
    );

    expect(
      screen.getByRole("textbox", { name: /conversation name/i }),
    ).toHaveAttribute("maxlength", String(MAX_TITLE_LENGTH));
  });
});
