// The server → client boundary for the workspace body. `page.tsx` is a Server
// Component and imports this directly; everything below is reached only through
// it and carries no directive of its own.
//
// Kept here and nowhere below on purpose: the directive *is* the boundary, so
// repeating it on every component hides where the split actually happens — and
// makes Next's TypeScript plugin treat each one as a server-facing entry, which
// it then flags for taking function props.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { ConversationList } from "@/components/chat/conversation-list";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { Button } from "@/components/ui/button";
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

/**
 * Owns `documents` for the whole workspace, and everything that mutates it.
 *
 * Documents and chat are one stateful unit rather than two siblings, because
 * chat depends on the document list: with nothing processed there is nothing to
 * search, and the composer says so instead of letting every question return the
 * same refusal.
 *
 * That dependency is why the state lives here. It used to sit inside
 * `DocumentsPanel`, with the workspace page computing `hasReadyDocuments` during
 * the *server* render and passing it down — so an upload updated the document
 * list by polling while chat kept the value it was born with, and stayed stuck
 * on "Nothing to search yet" until the page was reloaded by hand.
 *
 * This is the second time that exact bug has appeared here. The first was
 * `DocumentList` seeding `useState(initialDocuments)` and ignoring every later
 * value. Both have the same shape: a second copy of state that no longer tracks
 * the first. One owner, and no prop copied into state, removes the class rather
 * than the instance.
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
}: {
  workspaceId: string;
  initialDocuments: DocumentSummary[];
  initialMessages: ChatUIMessage[];
  /** Empty for guests, whose conversations are never stored. */
  chats: readonly ChatSummary[];
  activeChatId: string | null;
  canWrite: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);
  const [pollError, setPollError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
            <UploadDropzone workspaceId={workspaceId} onUploaded={refresh} />
          ) : null}

          <DocumentList
            documents={documents}
            canWrite={canWrite}
            busyId={busyId}
            pollError={pollError}
            // `void` rather than passing the async functions directly: the
            // handler props are typed to return void, and a floating promise
            // handed to an event attribute is the shape that silently swallows
            // rejections.
            onRetry={(id) => void retry(id)}
            onDelete={(id) => void remove(id)}
          />
        </div>

        {!canWrite ? (
          // Read-only visitors get a way forward rather than a dead end. A
          // signed-in visitor already has an account, so offering them
          // "Sign in" would go nowhere.
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
                <Link href={signedIn ? "/w" : "/sign-in"}>
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
              A form POST, not a link — and this was a link, which was a bug.

              Next prefetches `<Link>` targets in the viewport, and prefetching
              this href executed the handler behind it: conversations appeared on
              every page load and every time the list re-rendered. Creating a
              resource is not something a GET may do, because prefetchers,
              crawlers and tab-restore all issue GETs nobody clicked.

              The cost is losing middle-click and open-in-new-tab. A button that
              only acts when pressed is worth more than a link that acts when
              looked at.
            */}
            <form action={`/w/${workspaceId}/c/new`} method="post">
              <Button type="submit" variant="outline" size="sm">
                New conversation
              </Button>
            </form>
          </div>

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

        {/*
          Guests may ask questions of the demo — chat is a read operation, and
          the route authorizes `read` for exactly that reason. What they do not
          get is persistence: their conversation lives in browser state and is
          gone on reload, which is what keeps an unbounded write path off a
          public URL.
        */}
        <ChatPanel
          workspaceId={workspaceId}
          // Derived on every render from the same state the list shows, so an
          // upload that finishes processing opens the composer without a reload.
          hasReadyDocuments={documents.some(
            (document) => document.status === "ready",
          )}
          signedIn={signedIn}
          initialMessages={initialMessages}
        />
      </section>
    </>
  );
}
