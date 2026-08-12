import type { Metadata } from "next";

import { LocalWorkspace } from "@/components/local/local-workspace";
import { Badge } from "@/components/ui/badge";
import { pageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Local mode" };

// Outside `/w/[workspaceId]` and absent from `proxy.ts`'s `GUARDED` list on
// purpose: local mode has no workspace to scope to and no account to belong to.
export default function LocalPage() {
  return (
    <main id="main" className={pageShell("3xl")}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Local mode</h1>
        {/* Outline, not the accent: ADR 023 spends `--primary` on the citation
            and its highlight, and a warning label is not that. */}
        <Badge variant="outline">Experimental</Badge>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">
        Documents are parsed, indexed and answered on this machine. Nothing is
        uploaded, and no question reaches a model provider.
      </p>
      <p className="text-muted-foreground mt-2 text-sm">
        The model that runs here is small enough to fit in a browser, and it
        shows: answers are worse than cloud mode, and it sometimes states things
        your documents do not say. Check the citations.
      </p>

      <div className="mt-6">
        <LocalWorkspace />
      </div>
    </main>
  );
}
