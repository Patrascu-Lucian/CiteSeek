"use server";

// Every export here is a callable endpoint, so each one authorizes itself. An
// action is POST-only by construction — what it is not is private.

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import {
  createChatUnless,
  deleteFromTurn,
  deleteTurn,
} from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { CAP_PARAM, decideCap } from "@/lib/limits/caps";
import { resolvePlanLimits } from "@/lib/limits/config";

/** A POST, not a link: a prefetch executes a handler, and a GET created one per
 * page load. A **write** (ADR 040), so guests need no branch. */
export async function createConversation(workspaceId: string): Promise<void> {
  const auth = await authorizeWorkspace(workspaceId, "write");

  // An action has no response to return, and a workspace the reader cannot see
  // should not be distinguishable from one that is not there.
  if (isDenied(auth)) notFound();

  const limit = resolvePlanLimits().conversations;
  const admission = await createChatUnless(
    auth.workspaceId,
    auth.actorId,
    (existing) =>
      // The redirect names the cap from the query string, so only the fact of
      // refusal crosses back.
      decideCap("conversations", existing, limit).allowed ? null : "capped",
  );

  // The conversation list belongs to the layout, and a client navigation does
  // not refetch one — so the write has to invalidate it or the new row is
  // missing until something else refreshes the route (ADR 041).
  if (admission.admitted) revalidatePath(`/w/${workspaceId}`, "layout");

  // The fragment scrolls the refusal into view: it renders beside the
  // conversation list, below the documents.
  redirect(
    admission.admitted
      ? `/w/${workspaceId}/c/${admission.chat.id}`
      : `/w/${workspaceId}?${CAP_PARAM}=conversations#conversations-heading`,
  );
}

/** Answers whether anything went, so a caller that hid the turn first can put it
 * back rather than leave a stored message off screen. */
export async function deleteConversationTurn(
  workspaceId: string,
  chatId: string,
  messageId: string,
): Promise<{ deleted: boolean }> {
  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) notFound();

  const removed = await deleteTurn(
    auth.workspaceId,
    auth.actorId,
    chatId,
    messageId,
  );

  // Frees a message the cap was counting, and the cap is computed in a layout.
  if (removed > 0) revalidatePath(`/w/${workspaceId}`, "layout");

  return { deleted: removed > 0 };
}

/** Clears a question and everything after it, so the edited version can go
 * through the ordinary route rather than teaching that route a second mode
 * (ADR 043). */
export async function clearFromTurn(
  workspaceId: string,
  chatId: string,
  messageId: string,
): Promise<{ cleared: boolean }> {
  const auth = await authorizeWorkspace(workspaceId, "write");
  if (isDenied(auth)) notFound();

  const removed = await deleteFromTurn(
    auth.workspaceId,
    auth.actorId,
    chatId,
    messageId,
  );

  if (removed > 0) revalidatePath(`/w/${workspaceId}`, "layout");

  return { cleared: removed > 0 };
}
