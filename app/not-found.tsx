import Link from "next/link";
import type { Metadata } from "next";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = { title: "Not found" };

/**
 * The 404 for the whole app. Reached more often than it looks: authorization
 * answers "not found" for a workspace the caller may not see, so a 404 and a 403
 * are indistinguishable. The wording has to be true of both without saying which.
 */
export default function NotFound() {
  return (
    <StatusPage
      icon={FileQuestion}
      title="We couldn't find that page"
      description="The link may be out of date, or the page may no longer be here — or was never yours to see."
    >
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
    </StatusPage>
  );
}
