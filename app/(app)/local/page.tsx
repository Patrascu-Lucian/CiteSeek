import type { Metadata } from "next";

import { LocalDataControls } from "@/components/local/local-data-controls";
import { WebGpuGate } from "@/components/local/webgpu-gate";
import { pageShell } from "@/components/ui/page-shell";

export const metadata: Metadata = { title: "Local mode" };

// Outside `/w/[workspaceId]` and absent from `proxy.ts`'s `GUARDED` list on
// purpose: local mode has no workspace to scope to and no account to belong to.
export default function LocalPage() {
  return (
    <main id="main" className={pageShell("3xl")}>
      <h1 className="text-2xl font-semibold tracking-tight">Local mode</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Documents are parsed, indexed and answered on this machine. Nothing is
        uploaded, and no question reaches a model provider.
      </p>

      <div className="mt-6">
        <WebGpuGate>
          <p className="text-muted-foreground text-sm">
            This browser can run a model locally. Nothing to index yet —
            ingestion arrives in the next slice.
          </p>
        </WebGpuGate>
      </div>

      {/* Outside the gate on purpose. Losing WebGPU — a flag switched off, a
          driver change — must not strand a reader with documents they can see
          no way to delete. */}
      <div className="mt-6">
        <LocalDataControls />
      </div>
    </main>
  );
}
