// The server → client boundary. Repeating the directive below would hide where
// the split happens, and make Next treat each component as a client entry whose
// function props must be Server Actions.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, MessageSquareOff } from "lucide-react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { workspaceDocumentText } from "@/lib/documents/text-loader";
import { SourcePanel, type SourceTarget } from "@/components/chat/source-panel";
import { ConversationList } from "@/components/chat/conversation-list";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { uploadToWorkspace } from "@/lib/documents/upload";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ChatUIMessage } from "@/lib/ai/types";
import type { ChatSummary } from "@/lib/chats/queries";
import type { DocumentSummary } from "@/lib/documents/queries";
import type { CapCopy } from "@/lib/limits/caps";

/**
 * Owns `documents` and everything that mutates it. One unit rather than two
 * siblings because chat depends on the list — computed during the *server* render
 * instead, chat kept the value it was born with and stayed on "Nothing to search
 * yet" until a manual reload.
 *
 * Second instance of that shape (first: `DocumentList` seeding
 * `useState(initialDocuments)`). One owner, no prop copied into state.
 */

const POLL_INTERVAL_MS = 2_000;

function isInFlight(documents: readonly DocumentSummary[]): boolean {
  return documents.some(
    (document) =>
      document.status === "queued" || document.status === "processing",
  );
}

export function WorkspaceSections({
  workspaceId,
  initialDocuments,
  initialMessages,
  chats,
  activeChatId,
  canWrite,
  signedIn,
  isDemo,
  conversationCap = null,
}: {
  workspaceId: string;
  initialDocuments: DocumentSummary[];
  initialMessages: ChatUIMessage[];
  /** Empty for guests, whose conversations are never stored. */
  chats: readonly ChatSummary[];
  activeChatId: string | null;
  canWrite: boolean;
  signedIn: boolean;
  isDemo: boolean;
  /** Set only just after `/c/new` refused, and cleared by the next navigation. */
  conversationCap?: CapCopy | null;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [pollError, setPollError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // One panel, two openers: a citation from the transcript, a document from the list.
  const [source, setSource] = useState<SourceTarget | null>(null);

  // Memoized: the panel's effect depends on it, so a new function each render
  // would refetch the document on every keystroke elsewhere on the page.
  const loadDocumentText = useMemo(
    () => workspaceDocumentText(workspaceId),
    [workspaceId],
  );

  /*
    The conversation list is server-rendered, so after a rename or delete the
    server has to re-render it. `router.refresh()` re-runs the Server Component
    and reconciles — no second source of truth on the client, which is the same
    rule the documents list follows by polling rather than mutating locally.
  */
  const refreshFromServer = useCallback(() => router.refresh(), [router]);

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
    <>
      <section aria-labelledby="documents-heading" className="mt-10 space-y-4">
        <h2 id="documents-heading" className="text-lg font-medium">
          Documents
        </h2>

        <div className="space-y-4">
          {canWrite ? (
            <div>
              <UploadDropzone
                send={uploadToWorkspace(workspaceId)}
                onUploaded={refresh}
              />

              {/* Here, not in the dropzone: local mode shares that control and
                  sends nothing. */}
              <p className="text-muted-foreground mt-2 text-xs">
                You are uploading to a deployment on Google&rsquo;s{" "}
                <strong>paid Gemini tier</strong> — your document text is sent
                there to answer questions, and is not used to train their
                models.{" "}
                <Link href="/privacy" className="underline">
                  What is stored
                </Link>
              </p>
            </div>
          ) : null}

          <DocumentList
            documents={documents}
            canWrite={canWrite}
            busyId={busyId}
            pollError={pollError}
            // `void`: the prop returns void, and a floating promise on an event handler
            // silently swallows rejections.
            onRetry={(id) => void retry(id)}
            onDelete={(id) => void remove(id)}
            onOpen={(documentId, filename) => {
              setSource({ kind: "document", documentId, filename });
            }}
          />
        </div>

        {!canWrite ? (
          // A way forward rather than a dead end — a signed-in visitor already has
          // an account, so "Sign in" would go nowhere.
          <Card>
            <CardHeader>
              <FileText
                aria-hidden="true"
                className="text-muted-foreground size-5"
              />
              <CardTitle className="mt-3">
                This workspace is read-only
              </CardTitle>
              <CardDescription>
                {signedIn
                  ? "Your own workspace is where you can upload documents."
                  : "Sign in to upload documents of your own."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link
                  href={signedIn ? "/w" : "/sign-in"}
                  prefetch={signedIn ? false : undefined}
                >
                  {signedIn ? "Go to your workspace" : "Sign in to upload"}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {/*
        Only for a signed-in reader: guest conversations are never written down
        (ADR 013), so a guest has no history and an empty list would promise one.
      */}
      {signedIn ? (
        <section
          aria-labelledby="conversations-heading"
          className="mt-12 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="conversations-heading" className="text-lg font-medium">
              Conversations
            </h2>
            {/*
              A form POST, not a link — and this was a link, which was the bug:
              Next prefetches `<Link>` targets in the viewport, so conversations
              appeared on every page load. Creating a resource is not something a
              GET may do; prefetchers, crawlers and tab-restore all issue GETs
              nobody clicked. The cost is middle-click and open-in-new-tab.
            */}
            <form action={`/w/${workspaceId}/c/new`} method="post">
              <Button type="submit" variant="outline" size="sm">
                New conversation
              </Button>
            </form>
          </div>

          {conversationCap ? (
            <Notice
              icon={
                <MessageSquareOff
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
              }
              tone="muted"
              title={conversationCap.title}
              detail={conversationCap.detail}
            />
          ) : null}

          <ConversationList
            workspaceId={workspaceId}
            chats={chats}
            activeChatId={activeChatId}
            onChanged={refreshFromServer}
          />
        </section>
      ) : null}

      <section aria-labelledby="chat-heading" className="mt-12 space-y-4">
        <h2 id="chat-heading" className="text-lg font-medium">
          Ask
        </h2>

        {/* Guests may ask — chat is a read — but get no persistence: the
          conversation lives in browser state, which keeps an unbounded write path
          off a public URL. */}
        <ChatPanel
          /*
            `useChat` seeds from `initialMessages` once and then owns its state, so
            a *new* prop is ignored — deleting the last conversation left its
            messages on screen with nothing behind them. Keying rather than syncing
            prop into state: the conversation is this component's identity.
          */
          key={activeChatId ?? "none"}
          workspaceId={workspaceId}
          chatId={activeChatId}
          // Derived on every render from the same state the list shows, so an
          // upload that finishes processing opens the composer without a reload.
          hasReadyDocuments={documents.some(
            (document) => document.status === "ready",
          )}
          signedIn={signedIn}
          isDemo={isDemo}
          onOpenSource={(chatSource) => {
            setSource({ kind: "citation", source: chatSource });
          }}
          openChunkId={
            source?.kind === "citation" ? source.source.chunkId : null
          }
          initialMessages={initialMessages}
          canUpload={canWrite}
          // Only what is actually searchable. A document still processing is
          // not something a refusal may claim to be able to answer from.
          documents={documents
            .filter((document) => document.status === "ready")
            .map((document) => document.filename)}
          // Only for a signed-in reader: a guest's turns are never written
          // down, so there is no server-rendered list for them to go stale.
          onTurnComplete={signedIn ? refreshFromServer : undefined}
        />
      </section>

      <SourcePanel
        target={source}
        loadText={loadDocumentText}
        onClose={() => setSource(null)}
      />
    </>
  );
}
