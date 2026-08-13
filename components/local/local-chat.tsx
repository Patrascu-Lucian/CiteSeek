"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { SourcePanel } from "@/components/chat/source-panel";
import { Button } from "@/components/ui/button";
import type { ChatSource } from "@/lib/ai/types";
import {
  LOCAL_CHAT_MODEL_MB,
  chatModelStatus,
  loadChatModel,
  localGeneratorIsFake,
  resolveLocalGenerator,
} from "@/lib/local/generate";
import {
  hasConsentedToModelDownload,
  rememberModelConsent,
} from "@/lib/local/consent";
import { localDocumentText } from "@/lib/local/text-loader";
import { LocalChatTransport } from "@/lib/local/transport";

/** Not "check your connection": this also rejects when WebGPU errors on a
 * device after the gate has already accepted the adapter. */
const LOAD_FAILED =
  "The model could not be loaded. Check your connection and try again.";

type Load =
  | { status: "idle" }
  /** `percent: null` when this mount joined a download already running, where
   * the callback reporting bytes belongs to the mount that started it. */
  | { status: "loading"; percent: number | null }
  | { status: "ready" }
  | { status: "failed"; message: string };

/** What the gate shows on arrival, from stored state rather than assumed. */
function initialLoad(): Load {
  // Nothing to download when the stand-in is in use, so the gate would be a
  // consent prompt for an action that never happens.
  if (localGeneratorIsFake()) return { status: "ready" };

  if (chatModelStatus() === "ready") return { status: "ready" };

  // `percent: null` covers both ways of arriving here — rejoining a load this
  // page started, and resuming one agreed to on an earlier visit. Neither has a
  // byte count yet; the first `progress_total` supplies one.
  return chatModelStatus() === "loading" || hasConsentedToModelDownload()
    ? { status: "loading", percent: null }
    : { status: "idle" };
}

/**
 * The download is consented to before a byte is fetched, which is the whole
 * reason this gate exists rather than a spinner. Both numbers are measured:
 * 756 MB of weights, and two to three seconds to a first token once they are
 * cached (ADR 034 — an earlier ~11 s was measured on the CPU and withdrawn).
 * Declining leaves cloud mode working, which is what makes the offer honest.
 */
export function LocalChat({ filenames }: { filenames: readonly string[] }) {
  const [load, setLoad] = useState<Load>(initialLoad);
  const [openSource, setOpenSource] = useState<ChatSource | null>(null);

  /*
    The only place the model is loaded, so pressing the button and returning to
    a page you already agreed to take the same path. `loadChatModel` hands back
    the running promise when there is one, so this rejoins rather than starting
    a second. Keyed on `status` alone: the progress updates below change `load`
    without re-running it.
  */
  useEffect(() => {
    if (load.status !== "loading") return;

    let current = true;

    void loadChatModel(({ loaded, total }) => {
      if (current) {
        setLoad({
          status: "loading",
          percent: Math.round((loaded / total) * 100),
        });
      }
    }).then(
      () => {
        if (current) setLoad({ status: "ready" });
      },
      () => {
        if (current) setLoad({ status: "failed", message: LOAD_FAILED });
      },
    );

    return () => {
      current = false;
    };
  }, [load.status]);

  const transport = useMemo(
    () => new LocalChatTransport(resolveLocalGenerator()),
    [],
  );

  /** Records the agreement and lets the effect above do the work, so a returning
   * reader and a first-time one take one code path rather than two. */
  function consent() {
    rememberModelConsent();
    setLoad({ status: "loading", percent: null });
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
          cached by your browser. Answers take two or three seconds each —
          slower than cloud mode, which stays available either way.
        </p>

        {load.status === "loading" ? (
          <div className="mt-3">
            {/* The percent is deliberately outside the live region: it changes
                about a hundred times, and `role="status"` queues every one of
                them into a screen reader. */}
            {/* "Loading", not "Downloading": on a return visit the bytes are
                usually already in the browser's cache, and nothing here can tell
                which of the two is happening. */}
            <p role="status" className="text-muted-foreground text-sm">
              Loading the model. It downloads once and comes from your
              browser&rsquo;s cache after that.
            </p>
            {/* Not `<progress>`: styling its fill takes a different vendor rule
                per engine, and the default paints green. `aria-valuenow` is
                omitted rather than zeroed, which is how ARIA spells
                indeterminate. */}
            <div
              role="progressbar"
              aria-valuenow={load.percent ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Model download progress"
              className="bg-muted mt-2 h-1.5 w-full overflow-hidden rounded-full"
            >
              {load.percent === null ? (
                // A third of the track sliding across, because there is no
                // number to fill to. `motion-reduce` leaves it parked rather
                // than removing it — the text beside it says what is happening,
                // and a full bar would read as finished.
                <div className="bg-primary h-full w-1/3 animate-[indeterminate-bar_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
              ) : (
                <div
                  className="bg-primary h-full transition-[width] duration-300"
                  style={{ width: `${String(load.percent)}%` }}
                />
              )}
            </div>
          </div>
        ) : (
          <Button type="button" className="mt-3" onClick={consent}>
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
