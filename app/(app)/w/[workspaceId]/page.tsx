import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkspaceSections } from "@/components/workspace/workspace-sections";
import { loadLatestChat } from "@/lib/chats/queries";
import { toUIMessages } from "@/lib/chats/to-ui-messages";
import { getActor } from "@/lib/auth/actor";
import { canWrite, accessToWorkspace } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";
import { listDocuments } from "@/lib/documents/queries";

export const metadata: Metadata = { title: "Workspace" };

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const actor = await getActor();

  const workspace = await findWorkspaceById(workspaceId);

  // Renders `not-found.tsx` in this segment *with a 404 status*. Returning the
  // page body directly produced the right words under a 200 — a soft 404, which
  // tells crawlers and monitoring the URL is fine.
  if (!workspace || accessToWorkspace(actor, workspace) === "none") {
    notFound();
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
