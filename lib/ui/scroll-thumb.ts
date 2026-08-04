/**
 * Thumb arithmetic for the overlay scrollbar (ADR 020).
 *
 * Separated from the component because jsdom reports `scrollHeight`,
 * `clientHeight` and `scrollTop` as 0 on every element
 */

/** Under this a thumb on a long document is too small to aim at. */
export const MIN_THUMB_HEIGHT = 24;

export type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export type ThumbGeometry = {
  /** Offset from the top of the track, in pixels. */
  top: number;
  height: number;
};

/** `null` when the element cannot scroll — the caller renders nothing. */
export function thumbGeometry(
  { scrollTop, scrollHeight, clientHeight }: ScrollMetrics,
  minHeight: number = MIN_THUMB_HEIGHT,
): ThumbGeometry | null {
  if (clientHeight <= 0 || scrollHeight <= clientHeight) return null;

  const proportional = (clientHeight / scrollHeight) * clientHeight;
  const height = Math.min(clientHeight, Math.max(minHeight, proportional));

  const travel = clientHeight - height;
  const scrollable = scrollHeight - clientHeight;
  const progress = Math.min(1, Math.max(0, scrollTop / scrollable));

  return { top: progress * travel, height };
}

/**
 * Pixels of scroll per pixel of pointer movement while dragging the thumb.
 *
 * The thumb travels the track while the content travels its whole overflow, so
 * a drag that used the raw pointer delta would scroll a long document at a
 * crawl.
 */
export function dragScale(
  { scrollHeight, clientHeight }: ScrollMetrics,
  thumbHeight: number,
): number {
  const travel = clientHeight - thumbHeight;
  if (travel <= 0) return 0;

  return (scrollHeight - clientHeight) / travel;
}
