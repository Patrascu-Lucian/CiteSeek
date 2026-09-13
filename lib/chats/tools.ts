import { jsonSchema, stepCountIs, tool } from "ai";

import { listDocuments } from "@/lib/documents/queries";

/** Shared by the chat route and `eval:refusals`, so the eval gives the model
 * what production gives it rather than a copy that drifts. */
export function chatTools(workspaceId: string) {
  return {
    list_documents: tool({
      description:
        "List the documents in this workspace, with their processing status. Use when the user asks what they have uploaded rather than about the contents of a document.",
      // No input. The workspace is closed over below — the model cannot
      // name one, so there is no id for it to get wrong or to probe with.
      inputSchema: jsonSchema<Record<string, never>>({
        type: "object",
        properties: {},
        additionalProperties: false,
      }),
      execute: async () => {
        const documents = await listDocuments(workspaceId);

        // Deliberately a projection, not the row. Ids and error strings
        // are of no use to the model and would end up in its context.
        return documents.map((document) => ({
          filename: document.filename,
          status: document.status,
          pageCount: document.pageCount,
        }));
      },
    }),
  };
}

/** A tool call and then an answer. Without a bound, a model that keeps
 * calling the tool loops until the function times out. */
export const CHAT_STEP_LIMIT = stepCountIs(2);
