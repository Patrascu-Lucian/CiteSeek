import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Composer } from "./composer";

function renderComposer(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  const handlers = { onSubmit: vi.fn(), onStop: vi.fn() };

  render(
    <Composer isStreaming={false} disabled={false} {...handlers} {...props} />,
  );

  return {
    ...handlers,
    textbox: screen.getByRole("textbox", { name: /ask a question/i }),
  };
}

describe("Composer", () => {
  it("has a label even though none is visible", () => {
    renderComposer();

    expect(
      screen.getByRole("textbox", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("sends on Enter", async () => {
    const { onSubmit, textbox } = renderComposer();

    await userEvent.type(textbox, "What is the policy?");
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("What is the policy?");
  });

  it("hands up a trimmed question and clears itself", async () => {
    // The panel receives what was asked; the field resets so a follow-up can be
    // typed straight away.
    const { onSubmit, textbox } = renderComposer();

    await userEvent.type(textbox, "  What is the policy?  ");
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("What is the policy?");
    expect(textbox).toHaveValue("");
  });

  it("inserts a newline on Shift+Enter instead of sending", async () => {
    // A question about a document is often more than one line.
    const { onSubmit, textbox } = renderComposer();

    await userEvent.type(textbox, "What is the policy?");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textbox).toHaveValue("What is the policy?\n");
  });

  it("will not send an empty question", async () => {
    const { onSubmit, textbox } = renderComposer();

    await userEvent.type(textbox, "   ");
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("offers Stop instead of Send while streaming", async () => {
    const { onStop, onSubmit } = renderComposer({ isStreaming: true });

    expect(
      screen.queryByRole("button", { name: /send/i }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /stop/i }));

    expect(onStop).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not send again while a reply is still streaming", async () => {
    const { onSubmit, textbox } = renderComposer({ isStreaming: true });

    await userEvent.type(textbox, "What is the policy?");
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("the composer's shape", () => {
  it("opens at one row and grows from there", () => {
    const { textbox } = renderComposer();

    expect(textbox).toHaveAttribute("rows", "1");
  });

  it("names the control without showing a word", () => {
    // The label is the only name it has once "Send" is gone.
    const { textbox } = renderComposer();
    const send = screen.getByRole("button", { name: /send the question/i });

    expect(send).toHaveTextContent("");
    // After the field in the DOM, so Tab from a typed question reaches it.
    expect(textbox.compareDocumentPosition(send)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  /* Two buttons swapped by a branch would unmount the focused one the instant a
     stream opened, dropping focus to the body. */
  it("keeps focus on the control when it turns into Stop", async () => {
    const handlers = { onSubmit: vi.fn(), onStop: vi.fn() };
    const { rerender } = render(
      <Composer isStreaming={false} disabled={false} {...handlers} />,
    );

    await userEvent.type(screen.getByRole("textbox"), "What is the policy?");
    const send = screen.getByRole("button", { name: /send the question/i });
    send.focus();
    expect(send).toHaveFocus();

    rerender(<Composer isStreaming disabled={false} {...handlers} />);

    expect(screen.getByRole("button", { name: /stop the answer/i })).toBe(send);
    expect(send).toHaveFocus();
  });
});
