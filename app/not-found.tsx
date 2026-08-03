import Link from "next/link";
import type { Metadata } from "next";
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
 * The 404 for the whole app. Reached more often than it looks: authorization
 * answers "not found" for a workspace the caller may not see, so a 404 and a 403
 * are indistinguishable. The wording has to be true of both without saying which.
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
            <Link href="/demo" prefetch={false}>
              Try the demo
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
