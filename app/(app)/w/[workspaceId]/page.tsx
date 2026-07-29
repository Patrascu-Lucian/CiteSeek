import type { Metadata } from "next";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkspaceSections } from "@/components/workspace/workspace-sections";
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

      {/*
        Documents and chat render together as one client unit, because chat
        depends on the document list: `hasReadyDocuments` has to track uploads as
        they finish, and a value computed here would be frozen at server-render
        time.
      */}
      <WorkspaceSections
        workspaceId={workspace.id}
        initialDocuments={documents}
        initialMessages={storedChat ? toUIMessages(storedChat.messages) : []}
        canWrite={writable}
        signedIn={signedIn}
      />
    </main>
  );
}
