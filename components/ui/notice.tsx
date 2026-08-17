import type { ReactNode } from "react";

/**
 * A refusal the reader has to be able to act on: what happened, and the one
 * control that resolves it.
 *
 * `role="alert"` sits on the container. Nested regions read the title and detail
 * as two separate interruptions, which is why the parts are not each live.
 *
 * Extracted from `ChatError` when the conversation cap needed the same shape on
 * a server-rendered page — the two must not drift into different-looking ways of
 * saying no.
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
