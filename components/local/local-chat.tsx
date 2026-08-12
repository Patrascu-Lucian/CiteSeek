"use client";

import { useMemo, useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { SourcePanel } from "@/components/chat/source-panel";
import { Button } from "@/components/ui/button";
import type { ChatSource } from "@/lib/ai/types";
import {
  LOCAL_CHAT_MODEL_MB,
  loadChatModel,
  localGeneratorIsFake,
  resolveLocalGenerator,
} from "@/lib/local/generate";
import { localDocumentText } from "@/lib/local/text-loader";
import { LocalChatTransport } from "@/lib/local/transport";

type Load =
  | { status: "idle" }
  | { status: "loading"; percent: number }
  | { status: "ready" }
  | { status: "failed"; message: string };

/**
 * The download is consented to before a byte is fetched, which is the whole
 * reason this gate exists rather than a spinner. Both numbers are measured:
 * 756 MB of weights, and ~11 s to a first token even once they are cached.
 * Declining leaves cloud mode working, which is what makes the offer honest.
 */
export function LocalChat({ filenames }: { filenames: readonly string[] }) {
  const [load, setLoad] = useState<Load>(
    // Nothing to download when the stand-in is in use, so the gate would be a
    // consent prompt for an action that never happens.
    localGeneratorIsFake() ? { status: "ready" } : { status: "idle" },
  );
  const [openSource, setOpenSource] = useState<ChatSource | null>(null);

  const transport = useMemo(
    () => new LocalChatTransport(resolveLocalGenerator()),
    [],
  );

  async function download() {
    setLoad({ status: "loading", percent: 0 });

    try {
      await loadChatModel(({ loaded, total }) =>
        setLoad({
          status: "loading",
          percent: Math.round((loaded / total) * 100),
        }),
      );
      setLoad({ status: "ready" });
    } catch {
      setLoad({
        status: "failed",
        message:
          "The model could not be downloaded. Check your connection and try again.",
      });
    }
  }

  if (load.status !== "ready") {
    return (
      <section
        aria-labelledby="local-model"
        className="border-border rounded-md border p-4"
      >
        <h2 id="local-model" className="text-sm font-medium">
          Answering happens on this machine
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          It needs a language model, which is{" "}
          <strong>{LOCAL_CHAT_MODEL_MB} MB</strong> to download once and is then
          cached by your browser. Answers take a few seconds each — noticeably
          slower than cloud mode, which stays available either way.
        </p>

        {load.status === "loading" ? (
          <p role="status" className="text-muted-foreground mt-3 text-sm">
            Downloading the model — {load.percent}%. You can leave this page
            open; it resumes from the browser cache next time.
          </p>
        ) : (
          <Button
            type="button"
            className="mt-3"
            onClick={() => void download()}
          >
            Download the model
          </Button>
        )}

        {load.status === "failed" ? (
          <p role="alert" className="text-destructive mt-3 text-sm">
            {load.message}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <>
      <ChatPanel
        workspaceId="local"
        transport={transport}
        // Null: the upload area is already at the top of this page, so a link
        // would point at where the reader is standing.
        uploadHref={null}
        hasReadyDocuments={filenames.length > 0}
        documents={filenames}
        canUpload
        onOpenSource={setOpenSource}
        openChunkId={openSource?.chunkId ?? null}
      />

      <SourcePanel
        target={openSource ? { kind: "citation", source: openSource } : null}
        loadText={localDocumentText}
        onClose={() => setOpenSource(null)}
      />
    </>
  );
}
