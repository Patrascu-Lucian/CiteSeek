import Link from "next/link";
import { AlertCircle, Clock, MessageSquareOff, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import type { CapRefusalBody } from "@/lib/limits/caps";
import type { ParsedRefusal } from "@/lib/usage/limits";

/**
 * Four states, because the useful action differs and offering the wrong one is
 * worse than none: a retry under "daily capacity is gone" cannot work, and
 * teaches the reader the product is broken rather than busy.
 *
 * The cap is the one state with no action at all — what resolves it is deleting
 * something, which lives elsewhere on the page.
 */
export function ChatError({
  refusal,
  capRefusal,
  signedIn,
  onRetry,
}: {
  /** Null when this is an ordinary failure rather than a limit. */
  refusal: ParsedRefusal | null;
  /** A stock cap. Checked first: it offers no retry, and the rolling-window
   * states below all do. */
  capRefusal?: CapRefusalBody | null;
  signedIn: boolean;
  onRetry: () => void;
}) {
  if (capRefusal) {
    return (
      <Notice
        icon={
          <MessageSquareOff
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
        }
        tone="muted"
        title={capRefusal.title}
        detail={capRefusal.detail}
        action={null}
      />
    );
  }

  if (refusal?.code === "capacity_reached") {
    // Not a wording choice: "the demo is full" is false when only this address
    // is, and everyone else is still being served.
    const mine = refusal.scope === "caller";

    return (
      <Notice
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
      <Notice
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
    <Notice
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
