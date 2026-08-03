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
 * Not-found and unauthorized answer the same, or workspace ids could be
 * enumerated by comparing a 404 against a 403.
 *
 * A segment boundary, not a component `page.tsx` returns: that produced the right
 * words with a **200**, which tells crawlers and monitoring the URL is fine.
 * `notFound()` renders this *and* sets the status.
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
            <Link href="/demo" prefetch={false}>
              Try the demo
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
