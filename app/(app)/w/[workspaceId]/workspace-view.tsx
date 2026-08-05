import { notFound } from "next/navigation";

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
 * Shared by `/w/<id>` (last-used conversation) and `/w/<id>/c/<chatId>` (a named
 * one) rather than duplicated — everything else is identical and two copies would
 * drift. A conversation having its own URL is what makes the history list a set
 * of destinations rather than client state.
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

  // `not-found.tsx` *with a 404 status*. Returning the body directly gave the
  // right words under a 200 — a soft 404 tells crawlers the URL is fine.
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

    An unrecognized `chatId` is a 404 rather than a silent fallback to the latest
    conversation: the URL names a specific thing, and quietly showing a different
    one would make a deleted conversation look like it still existed. The helper
    filters on workspace *and* user, so someone else's chat id is
    indistinguishable from a missing one — which is the intended answer to both.
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
    <main
      id="main"
      className="mx-auto w-full max-w-5xl flex-1 px-3 py-12 sm:px-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {workspace.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {workspace.isDemo
              ? // "Read-only" is the badge beside this, and the heading is now
                // the workspace's own name rather than the product's.
                "A shared workspace for trying CiteSeek out."
              : "Your documents and chats live here."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {workspace.isDemo ? (
            <span className="border-border text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium">
              Read-only demo
            </span>
          ) : null}
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
        isDemo={workspace.isDemo}
      />
    </main>
  );
}
