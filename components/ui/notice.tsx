import type { ReactNode } from "react";

/**
 * A refusal the reader can act on: what happened, and the control that resolves
 * it. Shared with `ChatError` so the ways of saying no cannot drift apart.
 *
 * `role="alert"` on the container, not the parts — nested regions read title and
 * detail as two separate interruptions.
 */
export function Notice({
  icon,
  tone,
  title,
  detail,
  action,
}: {
  icon: ReactNode;
  tone: "destructive" | "muted";
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={
        tone === "destructive"
          ? "border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-lg border p-3 text-sm"
          : "border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3 text-sm"
      }
    >
      {icon}
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-1">{detail}</p>
      </div>
      {action}
    </div>
  );
}
