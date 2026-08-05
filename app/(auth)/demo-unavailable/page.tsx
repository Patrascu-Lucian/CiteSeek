import Link from "next/link";
import type { Metadata } from "next";

import { ServerCrash } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Demo unavailable" };

/**
 * Shown when the demo workspace has not been seeded or the database is
 * unreachable. This is an operator problem, not a visitor's -- so it says what
 * happened plainly and still offers a way forward instead of a dead end.
 */
export default function DemoUnavailablePage() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-3 py-16 sm:px-6"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <ServerCrash
            aria-hidden="true"
            className="text-muted-foreground size-5"
          />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>The demo isn&apos;t available</h1>
          </CardTitle>
          <CardDescription>
            The demo workspace hasn&apos;t been set up on this deployment. That
            is a configuration problem on our side, not something you did.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/">Back to the homepage</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in">Sign in instead</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
