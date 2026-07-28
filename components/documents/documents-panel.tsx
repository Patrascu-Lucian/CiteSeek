"use client";

import { useCallback, useEffect, useState } from "react";

import type { DocumentSummary } from "@/lib/documents/queries";

import { DocumentList } from "./document-list";
import { UploadDropzone } from "./upload-dropzone";

/**
 * Owns the document list and everything that mutates it.
 *
 * The upload control and the list are one stateful unit rather than two
 * siblings coordinating through `router.refresh()`. That earlier arrangement
 * had a bug worth remembering: `DocumentList` seeded its state with
 * `useState(initialDocuments)`, which captures the first value and ignores every
 * later one — so a refreshed server render never reached it, and on an empty
 * workspace polling never started either, because there was nothing in flight to
 * poll for. An uploaded file sat at "Queued" until the page was reloaded by
 * hand.
 *
 * Lifting the state removes the class of bug rather than patching the instance:
 * there is now one owner of `documents`, and no prop is ever copied into state.
 */

const POLL_INTERVAL_MS = 2_000;

function isInFlight(documents: readonly DocumentSummary[]): boolean {
  return documents.some(
    (document) =>
      document.status === "queued" || document.status === "processing",
  );
}

export function DocumentsPanel({
  workspaceId,
  initialDocuments,
  canWrite,
}: {
  workspaceId: string;
  initialDocuments: DocumentSummary[];
  canWrite: boolean;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [pollError, setPollError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/w/${workspaceId}/documents`);
      if (!response.ok) throw new Error("Could not load documents.");

      const payload = (await response.json()) as {
        documents: DocumentSummary[];
      };
      setDocuments(payload.documents);
      setPollError(null);
    } catch {
      // A failed poll is not a failed page. Keep the last known state visible
      // and say it may be stale, rather than blanking the list.
      setPollError("Status updates paused — could not reach the server.");
    }
  }, [workspaceId]);

  // Polls only while something is actually in flight, and stops once every
  // document is terminal — see ADR 010.
  useEffect(() => {
    if (!isInFlight(documents)) return;

    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [documents, refresh]);

  async function remove(documentId: string) {
    setBusyId(documentId);
    try {
      await fetch(`/api/w/${workspaceId}/documents/${documentId}`, {
        method: "DELETE",
      });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function retry(documentId: string) {
    setBusyId(documentId);
    try {
      const response = await fetch(
        `/api/w/${workspaceId}/documents/${documentId}/retry`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        setPollError(payload?.error ?? "Could not retry this document.");
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <UploadDropzone workspaceId={workspaceId} onUploaded={refresh} />
      ) : null}

      <DocumentList
        documents={documents}
        canWrite={canWrite}
        busyId={busyId}
        pollError={pollError}
        // `void` rather than passing the async functions directly: the handler
        // props are typed to return void, and a floating promise handed to an
        // event attribute is the shape that silently swallows rejections.
        onRetry={(id) => void retry(id)}
        onDelete={(id) => void remove(id)}
      />
    </div>
  );
}
