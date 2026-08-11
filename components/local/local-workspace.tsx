"use client";

import { useState } from "react";

import { LocalDataControls } from "./local-data-controls";
import { LocalUpload } from "./local-upload";

export function LocalWorkspace() {
  const [ingested, setIngested] = useState(0);

  return (
    <div className="space-y-6">
      <LocalUpload onIngested={() => setIngested((n) => n + 1)} />
      {/* Keyed so a finished ingest remounts the panel and it re-reads the
          store. Its count comes from IndexedDB, which nothing notifies. */}
      <LocalDataControls key={ingested} />
    </div>
  );
}
