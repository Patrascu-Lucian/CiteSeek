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

/**
 * Shorter than ingestion's 300s. A chat request that has not produced a first
 * token in a minute is not going to produce a useful one — the user has already
 * given up, and holding the function open costs quota for an answer nobody will
 * read.
 */
export const maxDuration = 60;

/** Read access, not write: a guest may ask questions of the demo workspace. */
const REQUIRED_ACCESS = "read" as const;

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * The text of the most recent user turn.
 *
 * v7 messages carry a `parts` array rather than a string, so a message can mix
 * text with tool calls and data. Only text is a question.
 */
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
 * The refusal, streamed in the same shape as a real answer so the client has one
 * code path — an assistant message with no sources part and therefore no chips.
 *
 * The text is a fixed server-side string and the model is never called, which is
 * what makes "I don't know" structural rather than instructed. The `refusal`
 * part carries *why*; the client turns that into what the reader can do next.
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

  // Pulled out before the closure below rather than read through `auth` and
  // `question` inside it: TypeScript drops narrowing at a function boundary, so
  // both would widen back to their unnarrowed types. Plain values need no
  // narrowing to survive.
  const { workspaceId: scope, actorType, actorId } = auth;
  const asked: string = question;

  /**
   * Before either branch returns: the query is embedded *before* the relevance
   * floor applies, so a question that matches nothing has still been paid for.
   * Metering only the answered branch would leave repeated nonsense — the
   * cheapest way to spend someone's quota — uncounted.
   */
  await recordUsage({
    actorType,
    actorId,
    ipHash,
    workspaceId: scope,
    kind: "embedding",
    inputTokens: retrievalTokens,
  });

  // Signed-in only: a guest is anonymous and unlimited, so writing rows for one
  // would put an unbounded write path behind a public URL (ADR 005).
  //
  // The client sends which conversation it is showing; `resolveChatForTurn`
  // checks that id against this workspace and user, so a guessed or stale id
  // cannot append to someone else's transcript.
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

  // The relevance floor, and the reason "I don't know" is structural: with no
  // passages the model is never called, so there is nothing to answer from and
  // nothing to cite. Compare with instructing a model to refuse, which works
  // most of the time.
  if (retrieved.length === 0) {
    // One extra query, and only on this branch: "nothing matched" and "there was
    // nothing to match against" need different things said to the reader, and
    // telling someone to upload a document they have already uploaded is the
    // failure this distinction exists to avoid.
    const reason: RefusalReason =
      (await countSearchableChunks(scope)) === 0
        ? "no_documents"
        : "no_relevant_passages";

    // Persisted like any other turn. A refusal is part of the conversation, and
    // a reload that silently dropped it would make the transcript a lie. The
    // reason rides along so the panel can be rebuilt rather than inferred from
    // the text, which would break the moment that sentence is reworded.
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
     * The provider's own quota error, which arrives *after* a 200 has been sent.
     * Our caps refuse before the stream opens as a JSON 429; Gemini's limits are
     * per project, so it can still return `RESOURCE_EXHAUSTED` once the status
     * line is gone. Emitting the same JSON body means one parser classifies both.
     *
     * The SDK default (`"An error occurred."`) is kept for everything else, so
     * server internals cannot leak — only a recognized 429 is described.
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
        // Fires once the model finishes, Stop included — a partial answer is
        // still what the reader was shown.
        //
        // `usage` is **aggregated across steps**, which matters because
        // `stopWhen: stepCountIs(2)` means a tool-using turn runs two; a per-step
        // figure would bill it at a fraction of what it cost.
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
