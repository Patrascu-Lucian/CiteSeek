"use client";

import Link from "next/link";
import { useEffect } from "react";
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
