import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Not-found and unauthorized are deliberately the same response.
 *
 * Distinguishing them would let anyone enumerate which workspace ids exist by
 * comparing a 404 against a 403. The cost is a slightly less helpful message for
 * the rare legitimate case; the benefit is that ids stay unguessable.
 *
 * A segment boundary rather than a component the page renders directly, which is
 * what it was before: returning this from `page.tsx` produced the right words
 * with a **200 status**. A soft 404 tells crawlers and uptime monitoring the URL
 * is fine, and makes "is the workspace missing?" unanswerable from logs.
 * `notFound()` renders this file *and* sets the status.
 *
 * The copy stays specific rather than falling back to the app-wide 404: someone
 * who followed a shared link needs "sign in" or "try the demo", not "go home".
 */
export default function WorkspaceNotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <Lock aria-hidden="true" className="text-muted-foreground size-5" />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>Workspace not available</h1>
          </CardTitle>
          <CardDescription>
            This workspace doesn&apos;t exist, or you don&apos;t have access to
            it. If someone shared a link with you, ask them to check it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/demo">Try the demo</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
