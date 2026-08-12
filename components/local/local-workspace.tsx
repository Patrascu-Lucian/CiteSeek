"use client";

import { useCallback, useEffect, useState } from "react";

import { listLocalDocuments } from "@/lib/local/store";

import { LocalChat } from "./local-chat";
import { LocalDataControls } from "./local-data-controls";
import { LocalUpload } from "./local-upload";
import { WebGpuGate } from "./webgpu-gate";

export function LocalWorkspace() {
  const [ingested, setIngested] = useState(0);
  const [ready, setReady] = useState<string[]>([]);

  const read = useCallback(
    () =>
      listLocalDocuments().then((documents) =>
        documents
          .filter((document) => document.status === "ready")
          .map((document) => document.filename),
      ),
    [],
  );

  useEffect(() => {
    let current = true;

    void read().then((filenames) => {
      if (current) setReady(filenames);
    });

    return () => {
      current = false;
    };
  }, [read, ingested]);

  return (
    <div className="space-y-6">
      <LocalUpload onIngested={() => setIngested((n) => n + 1)} />

      {/* Inside the gate: answering is the part that needs a GPU. Uploading and
          deleting stay outside it, so losing WebGPU never strands a reader with
          documents they cannot remove. */}
      <WebGpuGate>
        <LocalChat filenames={ready} />
      </WebGpuGate>

      {/* A prop, not a `key`: remounting would recreate the `role="status"`
          region, and a live region absent when the change happens announces
          nothing. Its count comes from IndexedDB, which nothing notifies. */}
      <LocalDataControls refreshToken={ingested} />
    </div>
  );
}
