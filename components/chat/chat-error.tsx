import Link from "next/link";
import { AlertCircle, Clock, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LimitRefusal } from "@/lib/usage/limits";

/**
 * Why a question did not get answered, and what to do about it.
 *
 * Three states rather than one, because the useful action differs and offering
 * the wrong one is worse than offering none. A retry button under "the daily
 * capacity is gone" is a button that cannot work — the reader presses it, waits,
 * and gets the same message, which teaches them the product is broken rather
 * than busy.
 *
 * Every state is a live region with an action. The quality bar is that no async
 * surface is a dead end; a failure that only describes itself is a dead end.
 */
export function ChatError({
  refusal,
  signedIn,
  onRetry,
}: {
  /** Null when this is an ordinary failure rather than a limit. */
  refusal: LimitRefusal | null;
  signedIn: boolean;
  onRetry: () => void;
}) {
  if (refusal === "capacity_reached") {
    return (
      <Alert
        icon={<Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
        tone="muted"
        title="The demo has reached today's capacity."
        detail={
          signedIn
            ? "It resets within 24 hours. Anything already uploaded stays where it is."
            : "It resets within 24 hours. Signing in gives you your own capacity, separate from the shared demo."
        }
        action={
          signedIn ? null : (
            // A real way forward rather than a consolation: the global cap
            // reserves headroom below the guest ceiling, so a signed-in reader
            // genuinely can keep working at a point where guests cannot.
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )
        }
      />
    );
  }

  if (refusal === "rate_limited") {
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

/**
 * `role="alert"` on the container, so the whole message is announced as one
 * thing. Splitting the announcement across nested regions reads the title and
 * the detail as separate interruptions.
 */
function Alert({
  icon,
  tone,
  title,
  detail,
  action,
}: {
  icon: React.ReactNode;
  tone: "destructive" | "muted";
  title: string;
  detail: string;
  action: React.ReactNode;
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
