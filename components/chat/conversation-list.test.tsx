import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_TITLE_LENGTH } from "@/lib/chats/titles";

import { ConversationList } from "./conversation-list";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

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
  render(
    <ConversationList
      workspaceId="w1"
      chats={chats}
      activeChatId={activeChatId}
      onChanged={onChanged}
    />,
  );
  return { onChanged };
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
