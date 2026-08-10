"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { detectWebGpu, type WebGpuSupport } from "@/lib/local/webgpu";

const COPY: Record<
  Extract<WebGpuSupport, { status: "unavailable" }>["reason"],
  { headline: string; detail: string }
> = {
  "no-api": {
    headline: "This browser doesn't support WebGPU.",
    detail:
      "Local mode runs the model on your own machine, which needs WebGPU. Recent versions of Chrome, Edge and Safari have it; Firefox is still rolling it out.",
  },
  "no-adapter": {
    headline: "WebGPU is present but this machine won't provide a GPU.",
    detail:
      "That usually means it is switched off behind a flag, or there is no supported graphics adapter available to the browser.",
  },
  errored: {
    headline: "WebGPU failed when asked for a device.",
    detail:
      "The browser has the API but errored on the request, so local mode has nothing to run on.",
  },
};

export function WebGpuGate({ children }: { children: React.ReactNode }) {
  const [support, setSupport] = useState<WebGpuSupport>({ status: "checking" });

  useEffect(() => {
    let current = true;

    void detectWebGpu().then((result) => {
      if (current) setSupport(result);
    });

    return () => {
      current = false;
    };
  }, []);

  if (support.status === "checking") {
    return (
      <p
        role="status"
        className="text-muted-foreground flex items-center gap-2 text-sm"
      >
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        Checking whether this browser can run a model locally…
      </p>
    );
  }

  if (support.status === "unavailable") {
    const { headline, detail } = COPY[support.reason];

    return (
      <div role="alert" className="border-border rounded-md border p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          {headline}
        </p>
        <p className="text-muted-foreground mt-2">{detail}</p>
        <p className="text-muted-foreground mt-2">
          Cloud mode still works, and is what the demo uses.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
