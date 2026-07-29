import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Composer } from "./composer";

function renderComposer(props: Partial<Parameters<typeof Composer>[0]> = {}) {
  const handlers = { onChange: vi.fn(), onSubmit: vi.fn(), onStop: vi.fn() };

  render(
    <Composer
      value="What is the policy?"
      isStreaming={false}
      disabled={false}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

describe("Composer", () => {
  it("has a label even though none is visible", () => {
    renderComposer();

    expect(
      screen.getByRole("textbox", { name: /ask a question/i }),
    ).toBeInTheDocument();
  });

  it("sends on Enter", async () => {
    const { onSubmit } = renderComposer();

    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("inserts a newline on Shift+Enter instead of sending", async () => {
    // A question about a document is often more than one line.
    const { onSubmit } = renderComposer();

    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("will not send an empty question", async () => {
    const { onSubmit } = renderComposer({ value: "   " });

    await userEvent.click(screen.getByRole("textbox"));
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
    const { onSubmit } = renderComposer({ isStreaming: true });

    await userEvent.click(screen.getByRole("textbox"));
    await userEvent.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
