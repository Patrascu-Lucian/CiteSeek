import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { APPEAR_AFTER_MS, NavigationProgress } from "./navigation-progress";

/**
 * The threshold, tested where time can be controlled. Asserted end-to-end it was
 * a claim about how fast the machine is — `docs/backlog.md`.
 */

const BAR = "[data-navigation-progress]";

/** Only an RSC request counts as a navigation; `isPrefetch` excludes the rest. */
const NAVIGATION = "/privacy?_rsc=abc123";

function bar() {
  return document.querySelector(BAR);
}

let settle: (value: Response) => void;
let original: typeof window.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  // Bound, for the reason the component states: detached, the native one throws.
  original = window.fetch.bind(window);

  // Held open until a test says otherwise, so a navigation's duration is the
  // thing under control.
  window.fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        settle = resolve;
      }),
  );
});

afterEach(() => {
  window.fetch = original;
  vi.useRealTimers();
});

/** `setInFlight` runs before the wrapper awaits, so this needs no flush. */
function navigate() {
  render(<NavigationProgress />);
  act(() => {
    void window.fetch(NAVIGATION);
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("NavigationProgress", () => {
  it("stays down for a navigation shorter than the threshold", async () => {
    navigate();
    advance(APPEAR_AFTER_MS - 50);

    // The wrapper awaits the response, so the decrement lands a microtask later.
    await act(async () => {
      settle(new Response());
      await Promise.resolve();
    });

    advance(APPEAR_AFTER_MS);

    expect(bar()).toBeNull();
  });

  it("appears once a navigation runs past the threshold", () => {
    navigate();
    advance(APPEAR_AFTER_MS + 1);

    expect(bar()).not.toBeNull();
  });

  it("ignores a prefetch, which every page makes on arrival", () => {
    render(<NavigationProgress />);
    act(() => {
      void window.fetch(NAVIGATION, {
        headers: { "Next-Router-Prefetch": "1" },
      });
    });
    advance(APPEAR_AFTER_MS + 1);

    expect(bar()).toBeNull();
  });

  it("announces nothing, being decoration over a state the page already shows", () => {
    render(<NavigationProgress />);

    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
