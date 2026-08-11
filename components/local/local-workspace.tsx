"use client";

import { useState } from "react";

import { LocalDataControls } from "./local-data-controls";
import { LocalUpload } from "./local-upload";

export function LocalWorkspace() {
  const [ingested, setIngested] = useState(0);

  return (
    <div className="space-y-6">
      <LocalUpload onIngested={() => setIngested((n) => n + 1)} />
      {/* A prop, not a `key`: remounting would recreate the `role="status"`
          region, and a live region absent when the change happens announces
          nothing. Its count comes from IndexedDB, which nothing notifies. */}
      <LocalDataControls refreshToken={ingested} />
    </div>
  );
}
