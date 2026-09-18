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

/**
 * jsdom lays nothing out: `scrollHeight` is 0 and `line-height` computes to
 * "normal", so the component reads NaN rows and never stacks. These give it the
 * measurements a browser would, which is the only part of this that needs one —
 * `e2e/composer.spec.ts` asserts the layout itself.
 */
function measuredAt(rows: number, textbox: HTMLElement) {
  textbox.style.lineHeight = "20px";
  textbox.style.paddingTop = "0px";
  textbox.style.paddingBottom = "0px";
  Object.defineProperty(textbox, "scrollHeight", {
    configurable: true,
    value: rows * 20,
  });
}

const controlRow = (textbox: HTMLElement) => textbox.parentElement!;

describe("the control row", () => {
  it("stays beside a question that fits on one row", async () => {
    const { textbox } = renderComposer();
    measuredAt(1, textbox);

    await userEvent.type(textbox, "How long is the notice period?");

    expect(controlRow(textbox)).not.toHaveAttribute("data-stacked");
  });

  it("drops below a question that wraps", async () => {
    // Bottom-aligned beside a wrapped question, the button takes a bite out of
    // the corner of the text rather than sitting under it.
    const { textbox } = renderComposer();
    measuredAt(3, textbox);

    await userEvent.type(textbox, "A question long enough to wrap");

    expect(controlRow(textbox)).toHaveAttribute("data-stacked");
  });

  it("comes back up when the question no longer needs the room", async () => {
    // Shift+Enter puts the button below, and deleting that newline has to put
    // it back: a row that only returns on an empty field reads as stuck.
    const { textbox } = renderComposer();
    measuredAt(2, textbox);
    await userEvent.type(textbox, "One line{Shift>}{Enter}{/Shift}two");
    expect(controlRow(textbox)).toHaveAttribute("data-stacked");

    measuredAt(1, textbox);
    await userEvent.type(textbox, "{Backspace}");

    expect(controlRow(textbox)).not.toHaveAttribute("data-stacked");
  });

  it("is inline again for the next question after one is sent", async () => {
    const { textbox } = renderComposer();
    measuredAt(3, textbox);
    await userEvent.type(textbox, "A question long enough to wrap");

    await userEvent.keyboard("{Enter}");

    expect(controlRow(textbox)).not.toHaveAttribute("data-stacked");
  });

  it("moves the same button rather than rendering another one", async () => {
    /* A wrapper rendered only when stacked would remount the button, dropping
       focus to the body — the hazard the comment beside it already names, on
       every transition rather than once per stream. */
    const { textbox } = renderComposer();
    const send = screen.getByRole("button", { name: /send the question/i });
    measuredAt(3, textbox);

    await userEvent.type(textbox, "A question long enough to wrap");

    expect(screen.getByRole("button", { name: /send the question/i })).toBe(
      send,
    );
  });
});
