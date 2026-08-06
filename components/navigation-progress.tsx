"use client";

import { useEffect, useState } from "react";

/**
 * A bar across the top while a route is being fetched — measured, nothing paints
 * for the first 340ms of a navigation. ADR 024 has the timings and the rejected
 * alternatives.
 */
function isPrefetch(init: RequestInit | undefined, input: RequestInfo | URL) {
  const fromInit = new Headers(init?.headers ?? {}).get("Next-Router-Prefetch");
  if (fromInit) return true;
  return input instanceof Request
    ? input.headers.get("Next-Router-Prefetch") !== null
    : false;
}

/** Under this, a navigation is quick enough that a bar reads as a flicker. */
const APPEAR_AFTER_MS = 200;

/** Long enough for the fill to reach the end and be seen doing it. */
const FINISH_MS = 220;

export function NavigationProgress() {
  const [inFlight, setInFlight] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    // Bound: detached from `window`, the native implementation throws on call.
    const original = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (!url.includes("_rsc=") || isPrefetch(init, input))
        return original(input, init);

      setInFlight((n) => n + 1);
      try {
        return await original(input, init);
      } finally {
        setInFlight((n) => n - 1);
      }
    };

    return () => {
      window.fetch = original;
    };
  }, []);

  // Both branches go through a timer. A state update run synchronously in an
  // effect cascades renders, and the linter is right to refuse it.
  useEffect(() => {
    const timer = setTimeout(
      () => setSlow(inFlight > 0),
      inFlight > 0 ? APPEAR_AFTER_MS : FINISH_MS,
    );
    return () => clearTimeout(timer);
  }, [inFlight]);

  // Stays mounted once `inFlight` clears, so the fill can run to the end rather
  // than disappearing partway.
  if (!slow) return null;

  return (
    <div
      // Decorative: each route's `loading.tsx` and live regions already say what
      // is happening, and a second announcement per navigation is noise.
      aria-hidden="true"
      data-navigation-progress=""
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5"
    >
      <div
        className="bg-primary h-full"
        style={
          inFlight === 0
            ? { width: "100%", transition: `width ${FINISH_MS}ms ease-out` }
            : { animation: "nav-progress 800ms ease-out forwards" }
        }
      />
    </div>
  );
}
