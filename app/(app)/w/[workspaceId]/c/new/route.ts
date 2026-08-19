import { NextResponse } from "next/server";

import { getActor } from "@/lib/auth/actor";
import { createChatUnless } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { CAP_PARAM, decideCap } from "@/lib/limits/caps";
import { resolvePlanLimits } from "@/lib/limits/config";

export const runtime = "nodejs";

/**
 * Creates a conversation, then redirects to it.
 *
 * **POST, not GET.** The first version was a GET so the control could be a link.
 * Next prefetches `<Link>` targets in the viewport, and a prefetch *executes the
 * handler* — so every page load created a conversation.
 *
 * **A GET must not create a resource**: prefetchers, crawlers, link previews and
 * tab restore all issue GETs nobody clicked. The cost is a submit button rather
 * than a link — no middle-click, no open-in-new-tab.
 *
 * Shares a segment with `/c/[chatId]`; a literal path wins over a dynamic one, so
 * "new" is never read as a chat id.
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

  // Here and never on `getOrCreateChat`: that one runs on the chat-turn path, so
  // a refusal there would drop the question rather than decline an action. It
  // cannot exceed this cap anyway — it inserts only at zero.
  const limit = resolvePlanLimits().conversations;
  const admission = await createChatUnless(
    auth.workspaceId,
    actor.id,
    (existing) =>
      // The redirect names the cap from the query string, so only the fact of
      // refusal crosses back.
      decideCap("conversations", existing, limit).allowed ? null : "capped",
  );

  if (!admission.admitted) {
    // Back where the button was, with the cap named. A 409 body would be raw
    // JSON on screen: this POST is a form submission, not `fetch`.
    // The fragment, so the browser scrolls the refusal into view: it renders
    // beside the conversation list, which sits below the documents.
    return NextResponse.redirect(
      new URL(
        `/w/${workspaceId}?${CAP_PARAM}=conversations#conversations-heading`,
        request.url,
      ),
      { status: 303 },
    );
  }

  /*
    303, not the default 307. A 307 preserves the method, so the browser would
    follow this redirect with another POST — at a page that does not accept one.
    303 is the status that means "your POST worked; now GET this instead", which
    is the whole post/redirect/get pattern.
  */
  return NextResponse.redirect(
    new URL(`/w/${workspaceId}/c/${admission.chat.id}`, request.url),
    { status: 303 },
  );
}
