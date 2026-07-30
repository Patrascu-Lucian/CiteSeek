"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * The error boundary for everything outside the workspace.
 *
 * The workspace has its own, which is the segment most likely to fail — it
 * queries on every render. This one covers what was left: the landing page,
 * `/sign-in`, `/demo`, `/w` itself. Without it those fall through to Next's
 * default error page, which is unstyled and offers nothing to do.
 *
 * Not `global-error.tsx`: that replaces the root layout and is only reachable
 * when the layout itself throws. This sits inside the layout, so the skip link
 * and the fonts survive — a reader hitting an error still gets the product's
 * chrome rather than a bare document.
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
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <AlertTriangle
            aria-hidden="true"
            className="text-muted-foreground size-5"
          />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>Something went wrong</h1>
          </CardTitle>
          <CardDescription>
            The page didn&apos;t load. Trying again often works — the problem is
            usually temporary.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
    </main>
  );
}
