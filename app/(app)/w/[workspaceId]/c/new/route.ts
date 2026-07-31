import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { createChat } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";

export const runtime = "nodejs";

/**
 * "New conversation" — creates one, then redirects to it.
 *
 * **POST, not GET, and that is the whole point of this file's history.**
 *
 * The first version was a `GET` so the control could be an ordinary link, with
 * a comment arguing the exception was safe because "the worst case is one empty
 * conversation". It was not safe. Next prefetches `<Link>` targets in the
 * viewport, and a prefetch of this href *executes the handler* — so every page
 * load created a conversation, and clicking between conversations re-rendered
 * the list and created more. Empty conversations appeared without anyone asking
 * for one, which is exactly the failure the same comment warned about for pages
 * before dismissing it for handlers.
 *
 * The rule holds without exception: **a GET must not create a resource.** A
 * prefetcher, a crawler, a link preview in a chat app, and a browser restoring
 * tabs will all issue GETs nobody clicked. The cost of the fix is that the
 * control is a submit button rather than a link — no middle-click, no
 * open-in-new-tab — which is a small price for an operation that should never
 * have been idempotent-looking in the first place.
 *
 * Note this route shares a segment with `/c/[chatId]`. A literal path wins over
 * a dynamic one in Next's matching, so "new" is never read as a chat id.
 */
export async function POST(
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
    return NextResponse.redirect(new URL(`/w/${workspaceId}`, request.url), {
      status: 303,
    });
  }

  const chat = await createChat(auth.workspaceId, actor.id);

  /*
    303, not the default 307. A 307 preserves the method, so the browser would
    follow this redirect with another POST — at a page that does not accept one.
    303 is the status that means "your POST worked; now GET this instead", which
    is the whole post/redirect/get pattern.
  */
  return NextResponse.redirect(
    new URL(`/w/${workspaceId}/c/${chat.id}`, request.url),
    { status: 303 },
  );
}
