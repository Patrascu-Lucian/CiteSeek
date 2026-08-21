"use server";

// Every export here is a callable endpoint, so each one authorizes itself. An
// action is POST-only by construction — what it is not is private.

import { notFound, redirect } from "next/navigation";

import { createChatUnless } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { CAP_PARAM, decideCap } from "@/lib/limits/caps";
import { resolvePlanLimits } from "@/lib/limits/config";

/**
 * A POST, not a link: a prefetch executes a handler, and a GET created one per
 * page load.
 *
 * A **write** (ADR 040): guests need no branch, since they cannot reach `"write"`.
 */
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

  // The fragment scrolls the refusal into view: it renders beside the
  // conversation list, below the documents.
  redirect(
    admission.admitted
      ? `/w/${workspaceId}/c/${admission.chat.id}`
      : `/w/${workspaceId}?${CAP_PARAM}=conversations#conversations-heading`,
  );
}
