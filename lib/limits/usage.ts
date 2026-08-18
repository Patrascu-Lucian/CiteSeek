import { countChats } from "@/lib/chats/queries";
import {
  countDocuments,
  sumExtractedCharacters,
} from "@/lib/documents/queries";

import { resolvePlanLimits } from "./config";

/** What the caps in `caps.ts` refuse on, read before anyone hits one. */

export type PlanUsageAxis = { used: number; limit: number };

export type PlanUsage = {
  documents: PlanUsageAxis;
  conversations: PlanUsageAxis;
  storage: PlanUsageAxis;
};

/**
 * Conversations are per reader, the other two per workspace — the same scopes
 * their caps count on, or the meter would disagree with the refusal.
 */
export async function planUsage(
  workspaceId: string,
  userId: string,
): Promise<PlanUsage> {
  const limits = resolvePlanLimits();

  const [documents, conversations, characters] = await Promise.all([
    countDocuments(workspaceId),
    countChats(workspaceId, userId),
    sumExtractedCharacters(workspaceId),
  ]);

  return {
    documents: { used: documents.total, limit: limits.documents },
    conversations: { used: conversations, limit: limits.conversations },
    storage: { used: characters, limit: limits.extractedCharacters },
  };
}
