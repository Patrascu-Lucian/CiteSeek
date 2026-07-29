import type { Metadata } from "next";

import Link from "next/link";
import { FileText, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatPanel } from "@/components/chat/chat-panel";
import { DocumentsPanel } from "@/components/documents/documents-panel";
import { loadLatestChat } from "@/lib/chats/queries";
import { toUIMessages } from "@/lib/chats/to-ui-messages";
import { getActor } from "@/lib/auth/actor";
import { canWrite, accessToWorkspace } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";
import { listDocuments } from "@/lib/documents/queries";

export const metadata: Metadata = { title: "Workspace" };

/**
 * Not-found and unauthorized are deliberately the same response.
 *
 * Distinguishing them would let anyone enumerate which workspace ids exist by
 * comparing a 404 against a 403. The cost is a slightly less helpful message for
 * the rare legitimate case; the benefit is that ids stay unguessable.
 */
function NotFoundOrDenied() {
  return (
    <main
      id="main"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <Lock aria-hidden="true" className="text-muted-foreground size-5" />
          <CardTitle asChild className="mt-3 text-xl">
            <h1>Workspace not available</h1>
          </CardTitle>
          <CardDescription>
            This workspace doesn&apos;t exist, or you don&apos;t have access to
            it. If someone shared a link with you, ask them to check it.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/demo">Try the demo</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const actor = await getActor();

  const workspace = await findWorkspaceById(workspaceId);

  if (!workspace || accessToWorkspace(actor, workspace) === "none") {
    return <NotFoundOrDenied />;
  }

  const writable = canWrite(actor, workspace);
  const signedIn = actor?.type === "user";

  // Server-rendered so the list is correct before any JavaScript runs; the
  // client component only refines it by polling.
  const documents = await listDocuments(workspace.id);

  // Only signed-in conversations are stored, so only they can be restored. A
  // guest reloading the demo starts fresh, which is the visible consequence of
  // not writing rows for anonymous visitors.
  const storedChat =
    actor?.type === "user"
      ? await loadLatestChat(workspace.id, actor.id)
      : null;

  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {workspace.isDemo
              ? "A shared, read-only workspace for trying CiteSeek out."
              : "Your documents and chats live here."}
          </p>
        </div>

        {workspace.isDemo ? (
          <span className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium">
            Read-only demo
          </span>
        ) : null}
      </header>

      <section aria-labelledby="documents-heading" className="mt-10 space-y-4">
        <h2 id="documents-heading" className="text-lg font-medium">
          Documents
        </h2>

        <DocumentsPanel
          workspaceId={workspace.id}
          initialDocuments={documents}
          canWrite={writable}
        />

        {!writable ? (
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
          workspaceId={workspace.id}
          hasReadyDocuments={documents.some(
            (document) => document.status === "ready",
          )}
          initialMessages={storedChat ? toUIMessages(storedChat.messages) : []}
        />
      </section>
    </main>
  );
}
