import { NextResponse } from "next/server";

import { deleteChat, renameChat } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";

export const runtime = "nodejs";

/** Tagged, not an `in` check: without the discriminant TypeScript widens the union. */
type Authorized =
  | { ok: false; response: NextResponse }
  | { ok: true; workspaceId: string; userId: string };

/**
 * Two checks, not one: this authorizes the *workspace*; `renameChat` and
 * `deleteChat` enforce chat ownership in SQL.
 *
 * Was `"read"` until ADR 040, on reasoning that turned out circular.
 */
async function authorize(workspaceId: string): Promise<Authorized> {
  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) return { ok: false, response: auth };

  return { ok: true, workspaceId: auth.workspaceId, userId: auth.actorId };
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
