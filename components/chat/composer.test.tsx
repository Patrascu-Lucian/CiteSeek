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
