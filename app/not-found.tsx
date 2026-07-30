import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Not found" };

/**
 * The 404 for the whole app.
 *
 * Without this file Next renders its own unstyled page, which is the one screen
 * in the product that would look like a different product. It is also reached
 * more often than it looks: `authorizeWorkspace` answers "not found" for a
 * workspace the caller may not see, deliberately, so that a 404 and a 403 are
 * indistinguishable and nobody can probe which ids exist.
 *
 * So the wording has to cover both cases honestly without hinting at which one
 * happened — "no longer here, or was never yours" is true of both and reveals
 * neither.
 */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <FileQuestion
            aria-hidden="true"
            className="text-muted-foreground size-5"
          />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>We couldn&apos;t find that page</h1>
          </CardTitle>
          <CardDescription>
            The link may be out of date, or the page may no longer be here — or
            was never yours to see.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3">
          {/* Two ways out rather than one, because which is useful depends on
              whether the reader has an account, and this page cannot know. */}
          <Button asChild>
            <Link href="/">Go to the home page</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/demo">Try the demo</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
