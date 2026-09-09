"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

/**
 * The boundary for everything outside the workspace, which has its own. **Not
 * `global-error.tsx`**: that replaces the root layout and only catches the layout
 * itself throwing. This sits inside it, so the fonts and skip link survive.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route failed:", error);
  }, [error]);

  return (
    <StatusPage
      icon={AlertTriangle}
      title="Something went wrong"
      description="The page didn't load. Trying again often works — the problem is usually temporary."
      contentClassName="space-y-4"
    >
      {/* Announced, because a client-side navigation that fails replaces the
          content without moving focus — a screen reader would otherwise be
          left on a page that silently became a different one. */}
      <div role="alert" className="sr-only">
        The page failed to load.
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground text-xs">
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
    </StatusPage>
  );
}
