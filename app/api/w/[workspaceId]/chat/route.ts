import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  jsonSchema,
  stepCountIs,
  streamText,
  toUIMessageStream,
  tool,
} from "ai";
import { NextResponse } from "next/server";

import {
  NO_RELEVANT_PASSAGES_REPLY,
  buildSources,
  buildSystemPrompt,
} from "@/lib/ai/prompt";
import { getChatModel } from "@/lib/ai/provider";
import type { ChatSource, ChatUIMessage, RefusalReason } from "@/lib/ai/types";
import { REFUSAL_PART_ID, SOURCES_PART_ID } from "@/lib/ai/types";
import { appendMessages, resolveChatForTurn } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { clientIpHash } from "@/lib/usage/client-ip";
import { enforceUsageLimits } from "@/lib/usage/enforce";
import { refusalBody } from "@/lib/usage/limits";
import { recordUsage } from "@/lib/usage/queries";
import { countSearchableChunks, listDocuments } from "@/lib/documents/queries";
import { retrieveChunks } from "@/lib/rag/retrieve";

/** Node runtime: retrieval reaches the database and the fake model uses node APIs. */
export const runtime = "nodejs";

/** Shorter than ingestion's 300s: a request with no first token after a minute
 * is an answer nobody will read, still burning quota. */
export const maxDuration = 60;

/** Read access, not write: a guest may ask questions of the demo workspace. */
const REQUIRED_ACCESS = "read" as const;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** v7 messages carry `parts`, which can mix text with tool calls and data. Only
 * text is a question. */
function lastUserText(messages: readonly ChatUIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (message.role !== "user") continue;

    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim();

    return text.length > 0 ? text : null;
  }

  return null;
}

function parseMessages(body: unknown): ChatUIMessage[] | null {
  if (typeof body !== "object" || body === null) return null;

  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) return null;

  const valid = messages.every(
    (message: unknown) =>
      typeof message === "object" &&
      message !== null &&
      "role" in message &&
      "parts" in message &&
      Array.isArray((message as { parts: unknown }).parts),
  );

  return valid ? (messages as ChatUIMessage[]) : null;
}

/**
 * Streamed in the same shape as a real answer, so the client has one code path.
 * Fixed server-side text and no model call — this is what makes "I don't know"
 * structural rather than instructed. The `refusal` part carries *why*.
 */
function refusalStream(reason: RefusalReason) {
  return createUIMessageStream<ChatUIMessage>({
    execute: ({ writer }) => {
      writer.write({
        type: "data-refusal",
        id: REFUSAL_PART_ID,
        data: { reason },
      });
      writer.write({ type: "text-start", id: "0" });
      writer.write({
        type: "text-delta",
        id: "0",
        delta: NO_RELEVANT_PASSAGES_REPLY,
      });
      writer.write({ type: "text-end", id: "0" });
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await params;

  const auth = await authorizeWorkspace(workspaceId, REQUIRED_ACCESS);
  if (isDenied(auth)) return auth;

  const ipHash = clientIpHash(request.headers);

  // Before the body is even parsed: this route's whole cost is the two provider
  // calls below it, so the cheapest possible refusal is the point.
  const refused = await enforceUsageLimits(auth, ipHash);
  if (refused) return refused;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Expected a JSON body.");
  }

  const messages = parseMessages(body);
  if (!messages) return badRequest("Expected a messages array.");

  const question = lastUserText(messages);
  if (!question) return badRequest("Expected a question.");

  // Optional: the conversation the client is showing. Validated against the
  // caller before it is used.
  const requestedChatId =
    typeof (body as { chatId?: unknown }).chatId === "string"
      ? (body as { chatId: string }).chatId
      : null;

  const { chunks: retrieved, tokens: retrievalTokens } = await retrieveChunks(
    auth.workspaceId,
    question,
  );

  // Destructured before the closure: TypeScript drops narrowing at a function
  // boundary, so reading through `auth` inside it would widen these back.
  const { workspaceId: scope, actorType, actorId } = auth;
  const asked: string = question;

  /** Before either branch: the query is embedded *before* the floor applies, so a
   * question that matched nothing was still paid for. Metering only the answered
   * branch leaves repeated nonsense uncounted. */
  await recordUsage({
    actorType,
    actorId,
    ipHash,
    workspaceId: scope,
    kind: "embedding",
    inputTokens: retrievalTokens,
  });

  // Signed-in only: persisting guest turns would put an unbounded write path
  // behind a public URL (ADR 005). `resolveChatForTurn` validates the id the
  // client sends, so a guess cannot append to someone else's transcript.
  const chatId =
    actorType === "user"
      ? (await resolveChatForTurn(scope, actorId, requestedChatId)).id
      : null;

  async function persist(
    answer: string,
    citations: ChatSource[],
    refusalReason: RefusalReason | null = null,
  ) {
    if (!chatId) return;

    await appendMessages(scope, actorId, chatId, [
      { role: "user", content: asked },
      { role: "assistant", content: answer, citations, refusalReason },
    ]);
  }

  // The relevance floor. No passages means no model call, so there is nothing to
  // cite — as opposed to instructing a model to refuse, which mostly works.
  if (retrieved.length === 0) {
    // One extra query, only on this branch: "nothing matched" and "nothing to
    // match against" need different copy, or we tell someone to upload a document
    // they already uploaded.
    const reason: RefusalReason =
      (await countSearchableChunks(scope)) === 0
        ? "no_documents"
        : "no_relevant_passages";

    // Persisted like any other turn — dropping it on reload would make the
    // transcript a lie. The reason rides along so the panel is rebuilt rather
    // than inferred from text that could be reworded.
    await persist(NO_RELEVANT_PASSAGES_REPLY, [], reason);
    return createUIMessageStreamResponse({ stream: refusalStream(reason) });
  }

  const sources = buildSources(retrieved);
  // Awaited before the stream opens rather than inside it: conversion can reject
  // on a malformed history, and a rejection there would surface as a broken
  // stream rather than a 400.
  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream<ChatUIMessage>({
    /**
     * The provider's quota error arrives *after* a 200. Our caps refuse before
     * the stream opens as a JSON 429, but Gemini's limits are per project, so
     * `RESOURCE_EXHAUSTED` can still land once the status line is gone. Same JSON
     * body, so one parser handles both. Everything else keeps the SDK's opaque
     * default rather than leaking internals.
     */
    onError: (error) =>
      APICallError.isInstance(error) && error.statusCode === 429
        ? JSON.stringify(refusalBody("capacity_reached"))
        : "An error occurred.",
    execute: ({ writer }) => {
      // Before the model has written a word. The sources are a fact about
      // retrieval, not a summary of what the model went on to claim.
      writer.write({
        type: "data-sources",
        id: SOURCES_PART_ID,
        data: sources,
      });

      const result = streamText({
        model: getChatModel(),
        system: buildSystemPrompt(sources),
        messages: modelMessages,
        tools: {
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
              const documents = await listDocuments(auth.workspaceId);

              // Deliberately a projection, not the row. Ids and error strings
              // are of no use to the model and would end up in its context.
              return documents.map((document) => ({
                filename: document.filename,
                status: document.status,
                pageCount: document.pageCount,
              }));
            },
          }),
        },
        // A tool call and then an answer. Without a bound, a model that keeps
        // calling the tool loops until the function times out.
        stopWhen: stepCountIs(2),
        // Fires on Stop too — a partial answer is still what was shown. `usage`
        // aggregates across steps, which matters because `stepCountIs(2)` means a
        // tool-using turn runs two.
        onFinish: async ({ text, usage }) => {
          await persist(text, sources);
          await recordUsage({
            actorType,
            actorId,
            ipHash,
            workspaceId: scope,
            kind: "chat",
            // Plain numbers here. The provider-level type reports these as
            // breakdowns; the SDK normalizes them before onFinish sees them.
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          });
        },
      });

      // The standalone helper over `result.toUIMessageStream()`: the method is
      // deprecated and goes away in the next major.
      writer.merge(toUIMessageStream({ stream: result.stream }));
    },
  });

  return createUIMessageStreamResponse({ stream });
}
