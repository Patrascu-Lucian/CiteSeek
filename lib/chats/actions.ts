"use server";

import { notFound, redirect } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { createChatUnless } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { CAP_PARAM, decideCap } from "@/lib/limits/caps";
import { resolvePlanLimits } from "@/lib/limits/config";

/**
 * Creates a conversation, then navigates to it.
 *
 * **Still a POST**, because a prefetch executes a handler and a link created one
 * per page load. `redirect` inside an action navigates client-side, so this
 * costs no document reload, and the form still works without JavaScript.
 */
export async function createConversation(workspaceId: string): Promise<void> {
  const auth = await authorizeWorkspace(workspaceId, "read");

  // An action has no response to return, and a workspace the reader cannot see
  // should not be distinguishable from one that is not there.
  if (isDenied(auth)) notFound();

  const actor = await getActor();
  if (actor?.type !== "user") {
    // Guest conversations are never stored (ADR 013), so there is nothing to
    // create. Send them back rather than failing at them.
    redirect(`/w/${workspaceId}`);
  }

  const limit = resolvePlanLimits().conversations;
  const admission = await createChatUnless(
    auth.workspaceId,
    actor.id,
    (existing) =>
      // The redirect names the cap from the query string, so only the fact of
      // refusal crosses back.
      decideCap("conversations", existing, limit).allowed ? null : "capped",
  );

  // The fragment scrolls the refusal into view: it renders beside the
  // conversation list, below the documents.
  redirect(
    admission.admitted
      ? `/w/${workspaceId}/c/${admission.chat.id}`
      : `/w/${workspaceId}?${CAP_PARAM}=conversations#conversations-heading`,
  );
}
