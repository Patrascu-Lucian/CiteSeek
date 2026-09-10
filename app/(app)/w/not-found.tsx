import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPage } from "@/components/ui/status-page";

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
    <StatusPage
      icon={Lock}
      title="Workspace not available"
      description="This workspace doesn't exist, or you don't have access to it. If someone shared a link with you, ask them to check it."
    >
      <Button asChild>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/demo" prefetch={false}>
          Try the demo
        </Link>
      </Button>
    </StatusPage>
  );
}
