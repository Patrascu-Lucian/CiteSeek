import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocalDataControls } from "./local-data-controls";

const { summarize, deleteEverything } = vi.hoisted(() => ({
  summarize: vi.fn(),
  deleteEverything: vi.fn(),
}));

vi.mock("@/lib/local/store", () => ({
  summarizeLocalStore: summarize,
  deleteEverythingLocal: deleteEverything,
}));

beforeEach(() => {
  summarize.mockReset();
  deleteEverything.mockReset();
});

const openDialog = async () => {
  await userEvent.click(
    await screen.findByRole("button", { name: "Delete everything" }),
  );

  return screen.findByRole("alertdialog");
};

describe("LocalDataControls", () => {
  it("says what is stored, in counts a reader can check", async () => {
    summarize.mockResolvedValue({ documents: 2, chunks: 59 });

    render(<LocalDataControls />);

    expect(
      await screen.findByText(/2 documents and 59 passages/i),
    ).toBeInTheDocument();
  });

  it("singularizes one document", async () => {
    summarize.mockResolvedValue({ documents: 1, chunks: 1 });

    render(<LocalDataControls />);

    expect(
      await screen.findByText(/1 document and 1 passage,/i),
    ).toBeInTheDocument();
  });

  it("offers nothing to delete when the store is empty", async () => {
    summarize.mockResolvedValue({ documents: 0, chunks: 0 });

    render(<LocalDataControls />);

    expect(
      await screen.findByRole("button", { name: "Delete everything" }),
    ).toBeDisabled();
  });

  it("names the counts again in the dialog, not just 'your data'", async () => {
    // The confirmation a reader is asked for is worthless if the consequence is
    // only stated on the page behind the dialog.
    summarize.mockResolvedValue({ documents: 2, chunks: 59 });

    render(<LocalDataControls />);

    expect(await openDialog()).toHaveTextContent(
      /2 documents and 59 passages/i,
    );
  });

  it("deletes, then reports the store is empty", async () => {
    summarize
      .mockResolvedValueOnce({ documents: 2, chunks: 59 })
      .mockResolvedValue({ documents: 0, chunks: 0 });
    deleteEverything.mockResolvedValue(undefined);

    render(<LocalDataControls />);
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete everything" }),
    );

    expect(deleteEverything).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/nothing from local mode remains/i),
    ).toBeInTheDocument();
    // Closed on success. Radix marks the page behind an open dialog
    // `aria-hidden`, so leaving it up puts the confirmation somewhere a screen
    // reader cannot reach — over a count that is no longer true.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("moves focus to the count, since the trigger it came from is now disabled", async () => {
    // Radix restores focus to the trigger on close, and this delete disables it.
    //  on a disabled button is a no-op, so the caret would land on
    // <body> and the next Tab would restart at the top of the page.
    summarize
      .mockResolvedValueOnce({ documents: 2, chunks: 59 })
      .mockResolvedValue({ documents: 0, chunks: 0 });
    deleteEverything.mockResolvedValue(undefined);

    render(<LocalDataControls />);
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete everything" }),
    );

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("status")),
    );
  });

  it("keeps the dialog open when the delete fails", async () => {
    summarize.mockResolvedValue({ documents: 2, chunks: 59 });
    deleteEverything.mockRejectedValue(new Error("blocked"));

    render(<LocalDataControls />);
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete everything" }),
    );

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("says nothing was deleted when the delete fails", async () => {
    // The dangerous wrong message: a failed wipe that reports success leaves a
    // reader believing their documents are gone.
    summarize.mockResolvedValue({ documents: 2, chunks: 59 });
    deleteEverything.mockRejectedValue(new Error("blocked"));

    render(<LocalDataControls />);
    const dialog = await openDialog();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete everything" }),
    );

    // Inside the still-open dialog. Radix hides the page behind it from the
    // accessibility tree, so an error rendered out there cannot be read.
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      /nothing was deleted/i,
    );
    expect(dialog).toHaveTextContent(/2 documents and 59 passages/i);
  });

  it("offers a retry when the store cannot be read at all", async () => {
    summarize.mockRejectedValueOnce(new Error("no idb"));
    summarize.mockResolvedValue({ documents: 0, chunks: 0 });

    render(<LocalDataControls />);
    await userEvent.click(
      await screen.findByRole("button", { name: /try again/i }),
    );

    await waitFor(() =>
      expect(screen.getByText(/nothing yet/i)).toBeInTheDocument(),
    );
  });
});
