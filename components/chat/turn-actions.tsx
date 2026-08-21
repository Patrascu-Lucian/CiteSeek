import { useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const HOLD_MS = 500;
/** Past this, the finger is scrolling. */
const SLOP_PX = 10;

/** Reveals a row's controls on hover, focus, or a hold (ADR 042). The hold is the
 * touch path — Tailwind gates `hover:` behind `@media (hover: hover)`. Hidden is
 * `opacity-0` *and* `pointer-events-none`, or a stray tap finds it anyway. */
export function TurnActions({
  children,
  bubble,
  className,
}: {
  /** The controls, revealed together. */
  children: ReactNode;
  /** The message itself, which is what gets held. */
  bubble: ReactNode;
  /** The row's own alignment. This element *is* the row, so the bubble's
   * percentage width resolves against it rather than against the controls. */
  className?: string;
}) {
  const [held, setHeld] = useState(false);
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  function cancel() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }

  return (
    <div
      className={cn("group flex w-full items-start gap-1", className)}
      onPointerDown={(event) => {
        // Nothing here calls `preventDefault`: it would take selection with it.
        if (event.pointerType !== "touch") return;
        origin.current = { x: event.clientX, y: event.clientY };
        timer.current = window.setTimeout(() => setHeld(true), HOLD_MS);
      }}
      onPointerMove={(event) => {
        const from = origin.current;
        if (!from) return;

        const moved =
          Math.abs(event.clientX - from.x) > SLOP_PX ||
          Math.abs(event.clientY - from.y) > SLOP_PX;
        if (moved) cancel();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
    >
      <div
        // The opacity is here, not on the control, so a reveal test reads this.
        data-turn-actions=""
        className={cn(
          "shrink-0 transition-opacity",
          held
            ? "opacity-100"
            : "pointer-events-none opacity-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
        )}
      >
        {children}
      </div>

      {bubble}
    </div>
  );
}
