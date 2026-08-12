"use client";

import { useCallback, useEffect, useState } from "react";

import { listLocalDocuments } from "@/lib/local/store";

import { LocalChat } from "./local-chat";
import { LocalDataControls } from "./local-data-controls";
import { LocalUpload } from "./local-upload";
import { WebGpuGate } from "./webgpu-gate";

export function LocalWorkspace() {
  const [revision, setRevision] = useState(0);
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

    // Two arguments, not `void …then(ok)`: withheld storage rejects here, and a
    // one-argument `then` leaves that unhandled. `LocalDataControls` reads the
    // same store and renders the error; this only has to stop asking.
    void read().then(
      (filenames) => {
        if (current) setReady(filenames);
      },
      () => {
        if (current) setReady([]);
      },
    );

    return () => {
      current = false;
    };
  }, [read, revision]);

  const changed = () => setRevision((n) => n + 1);

  return (
    <div className="space-y-6">
      <LocalUpload onIngested={changed} />

      {/* Inside the gate because `loadChatModel` asks for `device: "webgpu"` and
          throws without it. Uploading and deleting stay outside — those run on
          wasm, so losing WebGPU never strands a reader with documents they
          cannot remove. */}
      <WebGpuGate>
        <LocalChat filenames={ready} />
      </WebGpuGate>

      {/* A prop, not a `key`: remounting would recreate the `role="status"`
          region, and a live region absent when the change happens announces
          nothing. Its count comes from IndexedDB, which nothing notifies. */}
      <LocalDataControls refreshToken={revision} onCleared={changed} />
    </div>
  );
}
