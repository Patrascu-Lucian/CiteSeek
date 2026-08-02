import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";

import { WorkspaceSections } from "@/components/workspace/workspace-sections";
import { getActor } from "@/lib/auth/actor";
import { accessToWorkspace, canWrite } from "@/lib/auth/authorization";
import { findWorkspaceById } from "@/lib/auth/demo";
import {
  listChatMessages,
  listChats,
  loadLatestChat,
} from "@/lib/chats/queries";
import { toUIMessages } from "@/lib/chats/to-ui-messages";
import { listDocuments } from "@/lib/documents/queries";

/**
 * The workspace, with one conversation open.
 *
 * Shared by two routes rather than duplicated between them: `/w/<id>` opens
 * whichever conversation was last used, and `/w/<id>/c/<chatId>` opens a named
 * one. Everything else — the heading, the documents, the read-only badge — is
 * identical, and two copies of it would drift the first time either changed.
 *
 * A conversation gets its own URL so it can be linked, bookmarked, and reached
 * with the back button. That is also what makes the history list a list of
 * destinations rather than a widget holding client state.
 */
export async function WorkspaceView({
  workspaceId,
  chatId,
}: {
  workspaceId: string;
  /** Absent on `/w/<id>`, which opens the most recent conversation. */
  chatId?: string;
}) {
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

  /*
    Only signed-in conversations are stored, so only they can be restored or
    listed (ADR 013). A guest reloading the demo starts fresh, which is the
    visible consequence of not writing rows for anonymous visitors.

    An unrecognised `chatId` is a 404 rather than a silent fallback to the latest
    conversation: the URL names a specific thing, and quietly showing a different
    one would make a deleted conversation look like it still existed. The helper
    filters on workspace *and* user, so someone else's chat id is indistinguish-
    able from a missing one — which is the intended answer to both.
  */
  const [chats, openChat] = signedIn
    ? await Promise.all([
        listChats(workspace.id, actor.id),
        chatId
          ? listChatMessages(workspace.id, actor.id, chatId).then((messages) =>
              messages.length > 0 ? { chatId, messages } : null,
            )
          : loadLatestChat(workspace.id, actor.id),
      ])
    : [[], null];

  if (chatId && signedIn && !openChat) {
    // An empty conversation is legitimate — "New conversation" creates one — so
    // being empty is not enough to 404. Confirm it exists at all.
    if (!chats.some((chat) => chat.id === chatId)) notFound();
  }

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

        <div className="flex items-center gap-3">
          {workspace.isDemo ? (
            <span className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium">
              Read-only demo
            </span>
          ) : null}

          {/*
            Beside the workspace it describes, rather than in the global nav.
            Usage is workspace-scoped — `usage_events` carries a workspace id —
            so a header link would have to guess which workspace was meant, and
            would be wrong for anyone reading a different one.
          */}
          <Button asChild variant="outline" size="sm">
            <Link href={`/w/${workspace.id}/usage`}>Usage</Link>
          </Button>
        </div>
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
        initialMessages={openChat ? toUIMessages(openChat.messages) : []}
        chats={chats}
        activeChatId={openChat?.chatId ?? chatId ?? null}
        canWrite={writable}
        signedIn={signedIn}
      />
    </main>
  );
}
