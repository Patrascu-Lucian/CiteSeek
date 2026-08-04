import { describe, expect, it } from "vitest";

import { MIN_THUMB_HEIGHT, dragScale, thumbGeometry } from "./scroll-thumb";

describe("thumbGeometry", () => {
  it("returns nothing when the content fits", () => {
    expect(
      thumbGeometry({ scrollTop: 0, scrollHeight: 400, clientHeight: 400 }),
    ).toBeNull();
  });

  it("sizes the thumb as the visible share of the content", () => {
    // A quarter visible, so a quarter of the track.
    const geometry = thumbGeometry({
      scrollTop: 0,
      scrollHeight: 1600,
      clientHeight: 400,
    });

    expect(geometry).toEqual({ top: 0, height: 100 });
  });

  it("puts the thumb at the bottom of the track at full scroll", () => {
    const geometry = thumbGeometry({
      scrollTop: 1200,
      scrollHeight: 1600,
      clientHeight: 400,
    });

    // Bottom of the thumb meets the bottom of the track, exactly.
    expect(geometry).not.toBeNull();
    expect(geometry!.top + geometry!.height).toBe(400);
  });

  it("keeps a grabbable thumb on a very long document", () => {
    // Proportionally this would be 0.4px.
    const geometry = thumbGeometry({
      scrollTop: 0,
      scrollHeight: 400_000,
      clientHeight: 400,
    });

    expect(geometry!.height).toBe(MIN_THUMB_HEIGHT);
  });

  it("keeps the floored thumb inside the track at full scroll", () => {
    // The floor above breaks the proportion, so travel has to be measured from
    // the floored height or the thumb overshoots the bottom.
    const geometry = thumbGeometry({
      scrollTop: 399_600,
      scrollHeight: 400_000,
      clientHeight: 400,
    });

    expect(geometry!.top).toBe(400 - MIN_THUMB_HEIGHT);
  });

  it("clamps overscroll rather than running past the track", () => {
    // Rubber-band scrolling reports a scrollTop beyond the maximum.
    const geometry = thumbGeometry({
      scrollTop: 5000,
      scrollHeight: 1600,
      clientHeight: 400,
    });

    expect(geometry!.top).toBe(300);
  });

  it("returns nothing for an unmeasured element", () => {
    // What every element reports in jsdom, and what a display:none ancestor
    // reports in a browser.
    expect(
      thumbGeometry({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 }),
    ).toBeNull();
  });
});

describe("dragScale", () => {
  it("scales pointer movement to the content's overflow", () => {
    // 300px of track moves 1200px of content: 4px per pixel dragged.
    expect(
      dragScale({ scrollTop: 0, scrollHeight: 1600, clientHeight: 400 }, 100),
    ).toBe(4);
  });

  it("is 1:1 when the thumb travels as far as the content", () => {
    expect(
      dragScale({ scrollTop: 0, scrollHeight: 600, clientHeight: 400 }, 200),
    ).toBe(1);
  });

  it("refuses to divide by a track the thumb fills", () => {
    expect(
      dragScale({ scrollTop: 0, scrollHeight: 1600, clientHeight: 400 }, 400),
    ).toBe(0);
  });
});
