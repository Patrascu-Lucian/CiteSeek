"use client";

import { useEffect, useRef, useState } from "react";

import {
  type ScrollMetrics,
  type ThumbGeometry,
  dragScale,
  thumbGeometry,
} from "@/lib/ui/scroll-thumb";
import { cn } from "@/lib/utils";

function metricsOf(element: HTMLElement): ScrollMetrics {
  return {
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  };
}

/**
 * A scrollbar drawn over the content rather than beside it.
 */
export function OverlayScrollbar({
  resolve,
  className,
}: {
  /**
   * Called once, from an effect. A prop rather than a ref because a ref set by
   * a sibling is still null when this component's own effects run.
   */
  resolve: () => HTMLElement | null;
  className?: string;
}) {
  // Captured from the first render and deliberately not refreshed: re-running
  // the effect on every new closure would tear down the observers each render.
  const resolveRef = useRef(resolve);

  // A ref, not state: dragging writes `scrollTop` on it, and a value read out
  // of `useState` is not ours to mutate.
  const elementRef = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<ThumbGeometry | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ pointerY: 0, scrollTop: 0, scale: 0 });

  useEffect(() => {
    const element = resolveRef.current();
    elementRef.current = element;
    if (!element) return;

    const measure = () => setGeometry(thumbGeometry(metricsOf(element)));

    // The document dispatches its scroll event at `document`, never at `<html>`.
    const scrollSource: EventTarget =
      element === document.scrollingElement ? window : element;

    measure();
    scrollSource.addEventListener("scroll", measure, { passive: true });

    // Content that grows with neither a scroll nor a window resize — a
    // streaming answer is exactly that.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of element.children) observer.observe(child);

    return () => {
      scrollSource.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, []);

  // Non-null only once an element was resolved and measured as scrollable.
  if (!geometry) return null;

  return (
    /*
      Hidden from assistive technology, and transparent to clicks except on the thumb itself
    */
    <div
      aria-hidden="true"
      data-slot="overlay-scrollbar"
      className={cn("pointer-events-none w-2.5", className)}
    >
      <div
        data-slot="overlay-scrollbar-thumb"
        onPointerDown={(event) => {
          const element = elementRef.current;
          if (!element) return;

          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            pointerY: event.clientY,
            scrollTop: element.scrollTop,
            scale: dragScale(metricsOf(element), geometry.height),
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const element = elementRef.current;
          if (!dragging || !element) return;

          const { pointerY, scrollTop, scale } = drag.current;
          element.scrollTop = scrollTop + (event.clientY - pointerY) * scale;
        }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        style={{
          height: geometry.height,
          transform: `translateY(${geometry.top}px)`,
        }}
        className={cn(
          "bg-scrollbar-thumb pointer-events-auto mx-auto w-1 rounded-full transition-colors",
          dragging ? "bg-foreground/50" : "hover:bg-foreground/40",
        )}
      />
    </div>
  );
}

/** The page scroller. Mounted once, in the root layout. */
export function DocumentScrollbar() {
  return (
    <OverlayScrollbar
      resolve={() => document.scrollingElement as HTMLElement | null}
      // Below dialogs and sheets, which sit at z-50 and scroll their own body.
      className="fixed inset-y-0 right-0 z-30"
    />
  );
}
