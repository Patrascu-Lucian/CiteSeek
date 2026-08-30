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
      {/* Measured, not hedged (`eval/local-markers.md`). The old wording ended
          "check the citations", which this page cannot honour: the model almost
          never emits one. */}
      <p className="text-muted-foreground mt-2 text-sm">
        The model that runs here is small enough to fit in a browser, and it
        shows. Asked 24 questions about our own sample documents, it reached the
        right figure 15 times and stated something the documents do not say the
        rest. <strong>It also does not cite.</strong> It answered all 24 without
        linking one of them to a passage, and a number in square brackets is the
        model putting a citation marker where a value belongs — read it as a
        mistake, not a source. Cloud mode cites properly and is the better
        choice for anything that matters.
      </p>

      <div className="mt-6">
        <LocalWorkspace />
      </div>
    </main>
  );
}
