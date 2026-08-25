import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TurnActions } from "./turn-actions";

/** The hold only. Hover and focus are asserted in `e2e/delete-turn.spec.ts`,
 * where a real engine computes them. */

function row() {
  return render(
    <TurnActions bubble={<p>How much leave?</p>}>
      <button type="button">Delete</button>
    </TurnActions>,
  );
}

/** Tokens, not a substring: `group-hover:opacity-100` contains "opacity-100",
 * so matching the class string passes while hidden. */
function classes() {
  return [...document.querySelector("[data-turn-actions]")!.classList];
}

/** jsdom has no `PointerEvent`, so the type goes on the event. */
function hold(target: Element, init: Record<string, unknown> = {}) {
  fireEvent.pointerDown(target, {
    pointerType: "touch",
    clientX: 10,
    clientY: 10,
    ...init,
  });
}

/** `act`, because the reveal lands in a timer callback rather than a handler. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe("revealing a row's controls by holding it", () => {
  it("hides them until something reveals them", () => {
    row();

    expect(classes()).toContain("opacity-0");
    expect(classes()).toContain("pointer-events-none");
    // Still in the tree, so a screen reader needs no gesture.
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("reveals them after a hold", async () => {
    row();

    hold(screen.getByText("How much leave?"));
    await wait(600);

    expect(classes()).toContain("opacity-100");
    expect(classes()).not.toContain("pointer-events-none");
  });

  it("ignores a hold that is really a scroll", async () => {
    row();
    const bubble = screen.getByText("How much leave?");

    hold(bubble);
    fireEvent.pointerMove(bubble, { clientX: 10, clientY: 90 });
    await wait(600);

    expect(classes()).toContain("opacity-0");
  });

  it("ignores a tap too short to be a hold", async () => {
    row();
    const bubble = screen.getByText("How much leave?");

    hold(bubble);
    await wait(200);
    fireEvent.pointerUp(bubble);
    await wait(600);

    expect(classes()).toContain("opacity-0");
  });

  it("ignores a mouse held down, which has hover already", async () => {
    row();

    hold(screen.getByText("How much leave?"), { pointerType: "mouse" });
    await wait(600);

    expect(classes()).toContain("opacity-0");
  });
});
