import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, Clock, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ParsedRefusal } from "@/lib/usage/limits";

/**
 * Three states, because the useful action differs and offering the wrong one is
 * worse than none: a retry under "daily capacity is gone" cannot work, and
 * teaches the reader the product is broken rather than busy.
 *
 * Every state is a live region with an action — a failure that only describes
 * itself is a dead end.
 */
export function ChatError({
  refusal,
  signedIn,
  onRetry,
}: {
  /** Null when this is an ordinary failure rather than a limit. */
  refusal: ParsedRefusal | null;
  signedIn: boolean;
  onRetry: () => void;
}) {
  if (refusal?.code === "capacity_reached") {
    // Not a wording choice: "the demo is full" is false when only this address
    // is, and everyone else is still being served.
    const mine = refusal.scope === "caller";

    return (
      <Alert
        icon={<Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
        tone="muted"
        title={
          mine
            ? "You have reached today's limit for the demo."
            : "The demo has reached today's capacity."
        }
        detail={
          signedIn
            ? "It resets within 24 hours. Anything already uploaded stays where it is."
            : mine
              ? "It resets within 24 hours, and it counts per network — an office or campus shares one. Signing in gives you your own."
              : "It resets within 24 hours. Signing in gives you your own capacity, separate from the shared demo."
        }
        action={
          signedIn ? null : (
            // Not a consolation link: the global cap reserves headroom below the
            // guest ceiling, so signing in genuinely does keep working.
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )
        }
      />
    );
  }

  if (refusal?.code === "rate_limited") {
    return (
      <Alert
        icon={<Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
        tone="muted"
        title="That was a bit quick."
        detail="Too many questions in a short time. Wait a moment, then try again."
        action={
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <Alert
      icon={
        <AlertCircle
          aria-hidden="true"
          className="text-destructive mt-0.5 size-4 shrink-0"
        />
      }
      tone="destructive"
      title="That answer didn't come through."
      detail="The connection may have dropped. Your question is still here."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Retry
        </Button>
      }
    />
  );
}

/** `role="alert"` on the container: nested regions read the title and detail as
 * separate interruptions. */
function Alert({
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
  action: ReactNode;
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
