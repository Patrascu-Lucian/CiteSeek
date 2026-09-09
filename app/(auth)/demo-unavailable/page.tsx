import Link from "next/link";
import type { Metadata } from "next";

import { ServerCrash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = { title: "Demo unavailable" };

/**
 * Shown when the demo workspace has not been seeded or the database is
 * unreachable. This is an operator problem, not a visitor's -- so it says what
 * happened plainly and still offers a way forward instead of a dead end.
 */
export default function DemoUnavailablePage() {
  return (
    <StatusPage
      icon={ServerCrash}
      title="The demo isn't available"
      description="The demo workspace hasn't been set up on this deployment. That is a configuration problem on our side, not something you did."
    >
      <Button asChild>
        <Link href="/">Back to the homepage</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/sign-in">Sign in instead</Link>
      </Button>
    </StatusPage>
  );
}
