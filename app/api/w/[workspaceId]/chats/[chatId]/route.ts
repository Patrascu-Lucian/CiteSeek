import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { deleteChat, renameChat } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";

export const runtime = "nodejs";

/**
 * Renaming and deleting one conversation.
 *
 * Two checks, and they are not the same check. `authorizeWorkspace` answers
 * "may this caller touch this workspace at all" — it authorises **read** here,
 * because a conversation is not a mutation of the workspace and the demo is
 * read-only for everyone. Ownership of the *chat* is then enforced in SQL by the
 * query helpers, which filter on user as well as workspace.
 *
 * That split matters: read access to a shared workspace must not imply write
 * access to a conversation inside it, and the demo workspace is readable by
 * every guest. Authorising `write` instead would have been wrong in the other
 * direction — it would refuse a signed-in user renaming their own conversation
 * in the demo, which is theirs.
 *
 * Guests are refused outright. Their conversations are never persisted (ADR
 * 013), so there is no row for them to address, and a guest reaching here is
 * either confused or probing.
 */
const GUEST_REFUSAL = {
  error: "Guest conversations are not saved, so there is nothing to change.",
} as const;

/**
 * Tagged rather than distinguished by an `in` check: without the discriminant,
 * TypeScript widens the union at the call site and `response` reads as possibly
 * undefined, which the handlers would then have to assert away.
 */
type Authorised =
  | { ok: false; response: NextResponse }
  | { ok: true; workspaceId: string; userId: string };

async function authorise(workspaceId: string): Promise<Authorised> {
  const auth = await authorizeWorkspace(workspaceId, "read");
  if (isDenied(auth)) return { ok: false, response: auth };

  const actor = await getActor();
  if (actor?.type !== "user") {
    return {
      ok: false,
      response: NextResponse.json(GUEST_REFUSAL, { status: 403 }),
    };
  }

  return { ok: true, workspaceId: auth.workspaceId, userId: actor.id };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string; chatId: string }> },
) {
  const { workspaceId, chatId } = await params;

  const authorised = await authorise(workspaceId);
  if (!authorised.ok) return authorised.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const title = (body as { title?: unknown })?.title;
  if (typeof title !== "string") {
    return NextResponse.json({ error: "Expected a title." }, { status: 400 });
  }

  const renamed = await renameChat(
    authorised.workspaceId,
    authorised.userId,
    chatId,
    title,
  );

  // Not-found and not-yours are the same answer, as everywhere else here: a 403
  // would confirm the conversation exists and belongs to someone.
  if (!renamed) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string; chatId: string }> },
) {
  const { workspaceId, chatId } = await params;

  const authorised = await authorise(workspaceId);
  if (!authorised.ok) return authorised.response;

  const deleted = await deleteChat(
    authorised.workspaceId,
    authorised.userId,
    chatId,
  );

  if (!deleted) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  }

  // The messages go with it through the foreign key's cascade.
  return new NextResponse(null, { status: 204 });
}
