import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { deleteChat, renameChat } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";

export const runtime = "nodejs";

/**
 * Two checks, and not the same check. `authorizeWorkspace` authorizes **read** —
 * a conversation is not a mutation of the workspace, and the demo is read-only
 * for everyone. Ownership of the *chat* is enforced in SQL, filtering on user as
 * well as workspace.
 *
 * Read access to a shared workspace must not imply write access to a conversation
 * inside it. Authorizing `write` would fail the other way, refusing a signed-in
 * user renaming their own conversation in the demo.
 *
 * Guests are refused outright: their conversations are never persisted (ADR 013),
 * so there is no row to address.
 */
const GUEST_REFUSAL = {
  error: "Guest conversations are not saved, so there is nothing to change.",
} as const;

/** Tagged rather than an `in` check: without the discriminant TypeScript widens
 * the union and `response` reads as possibly undefined. */
type Authorized =
  | { ok: false; response: NextResponse }
  | { ok: true; workspaceId: string; userId: string };

async function authorize(workspaceId: string): Promise<Authorized> {
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

  const authorized = await authorize(workspaceId);
  if (!authorized.ok) return authorized.response;

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
    authorized.workspaceId,
    authorized.userId,
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

  const authorized = await authorize(workspaceId);
  if (!authorized.ok) return authorized.response;

  const deleted = await deleteChat(
    authorized.workspaceId,
    authorized.userId,
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
