"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

/**
 * Route-level error boundary. Covers the case the happy path cannot: the
 * database being unreachable mid-request. `reset()` re-runs the segment, so a
 * transient failure is recoverable without a full page reload.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Real telemetry arrives with the observability work; until then this at
    // least surfaces the digest needed to find it in server logs.
    console.error("Workspace route failed:", error);
  }, [error]);

  return (
    <StatusPage
      icon={AlertTriangle}
      title="This workspace didn't load"
      description="Something went wrong on our side. Trying again often works — the problem is usually temporary."
      contentClassName="space-y-4"
    >
      <div role="alert" className="sr-only">
        The workspace failed to load.
      </div>
      <Button onClick={reset}>Try again</Button>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
    </StatusPage>
  );
}
