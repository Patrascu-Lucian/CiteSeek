import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/*
  jsdom implements no ResizeObserver, and `OverlayScrollbar` constructs one on
  mount — so every component rendering a scroll container threw before its own
  assertions ran. A stub rather than a polyfill: jsdom lays nothing out, so an
  observer that reported sizes would report zeros either way, and the geometry
  it feeds is unit-tested in `lib/ui/scroll-thumb.test.ts` instead.

  Assigned rather than `vi.stubGlobal`, because `source-panel.test.tsx` and
  `workspace-sections.test.tsx` call `vi.unstubAllGlobals()` in `afterEach` and
  would take this with them from their second test onward.
*/
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => {
  cleanup();
});
