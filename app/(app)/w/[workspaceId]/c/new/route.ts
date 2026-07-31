import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { createChat } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";

export const runtime = "nodejs";

/**
 * "New conversation" — creates one, then redirects to it.
 *
 * A route handler rather than a page, because it **writes**. A page that created
 * a row on render would create one every time Next prefetched the link, and Next
 * prefetches links in the viewport by default — the button would quietly fill
 * the list with empty conversations nobody opened. The same reasoning keeps
 * workspace creation in `/w` rather than in a page.
 *
 * This is a `GET` so the control can be an ordinary link, which brings
 * middle-click, open-in-new-tab and keyboard activation for nothing. That is a
 * deliberate exception to "GET must not write": the alternative is a form POST,
 * and the cost of the exception is bounded — the worst case is one empty
 * conversation, which the reader can delete and which the list shows honestly.
 *
 * Note this route shares a segment with `/c/[chatId]`. A literal path wins over
 * a dynamic one in Next's matching, so "new" is never read as a chat id.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const auth = await authorizeWorkspace(workspaceId, "read");
  if (isDenied(auth)) return auth;

  const actor = await getActor();
  if (actor?.type !== "user") {
    // Guest conversations are never stored (ADR 013), so there is nothing to
    // create. Send them back rather than failing at them.
    return NextResponse.redirect(new URL(`/w/${workspaceId}`, request.url));
  }

  const chat = await createChat(auth.workspaceId, actor.id);

  return NextResponse.redirect(
    new URL(`/w/${workspaceId}/c/${chat.id}`, request.url),
  );
}
