// The server → client boundary. Repeating the directive lower down would make
// Next treat those components as client *entries*, whose function props must be
// Server Actions.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileText, MessageSquareOff } from "lucide-react";

import { workspaceDocumentText } from "@/lib/documents/text-loader";
import { SourcePanel, type SourceTarget } from "@/components/chat/source-panel";
import { ConversationList } from "@/components/chat/conversation-list";
import { DocumentList } from "@/components/documents/document-list";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { createConversation } from "@/lib/chats/actions";
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
import type { ChatSource } from "@/lib/ai/types";
import type { ChatSummary } from "@/lib/chats/queries";
import type { DocumentSummary } from "@/lib/documents/queries";
import { CAP_PARAM, type CapCopy } from "@/lib/limits/caps";

import { WorkspaceShellProvider } from "./workspace-shell-context";

/** Owns `documents` and everything that mutates it. One owner, no prop copied
 * into state. */

const POLL_INTERVAL_MS = 2_000;

function isInFlight(documents: readonly DocumentSummary[]): boolean {
  return documents.some(
    (document) =>
      document.status === "queued" || document.status === "processing",
  );
}

export function WorkspaceShell({
  workspaceId,
  initialDocuments,
  chats,
  canWrite,
  signedIn,
  conversationCap,
  children,
}: {
  workspaceId: string;
  initialDocuments: DocumentSummary[];
  /** Empty for guests, whose conversations are never stored. */
  chats: readonly ChatSummary[];
  canWrite: boolean;
  signedIn: boolean;
  /** Rendered only when `CAP_PARAM` is on the URL. */
  conversationCap: CapCopy | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState(initialDocuments);
  const [pollError, setPollError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [source, setSource] = useState<SourceTarget | null>(null);

  // Memoized: the panel's effect depends on it, so a new function each render
  // would refetch the document on every keystroke elsewhere on the page.
  const loadDocumentText = useMemo(
    () => workspaceDocumentText(workspaceId),
    [workspaceId],
  );

  // The conversation list is server-rendered, so a rename or delete re-runs the
  // Server Component rather than mutating a second copy on the client.
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
        setPollError(payload?.error ?? "Could not retry that document.");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  // From the URL, because a layout is never given the `chatId` segment.
  // `/w/<id>` names none and opens `chats[0]`, which `listChats` orders newest.
  const namedChatId = pathname.match(/\/c\/([^/]+)$/)?.[1] ?? null;
  const activeChatId = namedChatId ?? chats[0]?.id ?? null;

  const readyFilenames = useMemo(
    () =>
      documents
        .filter((document) => document.status === "ready")
        .map((document) => document.filename),
    [documents],
  );

  const openSource = useCallback(
    (chatSource: ChatSource) =>
      setSource({ kind: "citation", source: chatSource }),
    [],
  );

  const shell = useMemo(
    () => ({
      hasReadyDocuments: readyFilenames.length > 0,
      readyFilenames,
      openSource,
      openChunkId: source?.kind === "citation" ? source.source.chunkId : null,
    }),
    [readyFilenames, openSource, source],
  );

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
        No history exists for a guest (ADR 013) or on the demo (ADR 040).
        `canWrite` rather than `!isDemo`, so the control disappears for the same
        reason the server refuses it.
      */}
      {signedIn && canWrite ? (
        <section
          aria-labelledby="conversations-heading"
          className="mt-12 space-y-4"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="conversations-heading" className="text-lg font-medium">
              Conversations
            </h2>
            {/* A form, never a link — see `createConversation`. */}
            <form action={createConversation.bind(null, workspaceId)}>
              <Button type="submit" variant="outline" size="sm">
                New conversation
              </Button>
            </form>
          </div>

          {conversationCap &&
          searchParams.get(CAP_PARAM) === "conversations" ? (
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

      <WorkspaceShellProvider value={shell}>{children}</WorkspaceShellProvider>

      <SourcePanel
        target={source}
        loadText={loadDocumentText}
        onClose={() => setSource(null)}
      />
    </>
  );
}
