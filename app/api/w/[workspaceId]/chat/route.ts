import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { NextResponse } from "next/server";

import {
  NO_RELEVANT_PASSAGES_REPLY,
  buildSources,
  buildSystemPrompt,
} from "@/lib/ai/prompt";
import { getChatModel } from "@/lib/ai/provider";
import type { ChatSource, ChatUIMessage } from "@/lib/ai/types";
import { SOURCES_PART_ID } from "@/lib/ai/types";
import { appendMessages, getOrCreateChat } from "@/lib/chats/queries";
import { authorizeWorkspace, isDenied } from "@/lib/documents/authorize";
import { listDocuments } from "@/lib/documents/queries";
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
 * The refusal, streamed in the same shape as a real answer.
 *
 * Emitted as a UI message stream rather than a plain JSON response so the client
 * has one code path: a refusal is an assistant message like any other, with no
 * sources part and therefore no chips. Nothing on the client needs to know this
 * branch exists.
 */
function refusalStream() {
  return createUIMessageStream<ChatUIMessage>({
    execute: ({ writer }) => {
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

  const retrieved = await retrieveChunks(auth.workspaceId, question);

  // Pulled out before the closure below rather than read through `auth` and
  // `question` inside it: TypeScript drops narrowing at a function boundary, so
  // both would widen back to their unnarrowed types. Plain values need no
  // narrowing to survive.
  const { workspaceId: scope, actorType, actorId } = auth;
  const asked: string = question;

  // Signed-in conversations persist; guests keep theirs in browser state only.
  // A guest is anonymous and unlimited, so writing rows for one would put an
  // unbounded write path behind a public URL — the concern ADR 005 raised about
  // the demo workspace, which chat would otherwise reintroduce.
  const chatId =
    actorType === "user" ? (await getOrCreateChat(scope, actorId)).id : null;

  async function persist(answer: string, citations: ChatSource[]) {
    if (!chatId) return;

    await appendMessages(scope, actorId, chatId, [
      { role: "user", content: asked },
      { role: "assistant", content: answer, citations },
    ]);
  }

  // The relevance floor, and the reason "I don't know" is structural: with no
  // passages the model is never called, so there is nothing to answer from and
  // nothing to cite. Compare with instructing a model to refuse, which works
  // most of the time.
  if (retrieved.length === 0) {
    // Persisted like any other turn. A refusal is part of the conversation, and
    // a reload that silently dropped it would make the transcript a lie.
    await persist(NO_RELEVANT_PASSAGES_REPLY, []);
    return createUIMessageStreamResponse({ stream: refusalStream() });
  }

  const sources = buildSources(retrieved);
  // Awaited before the stream opens rather than inside it: conversion can reject
  // on a malformed history, and a rejection there would surface as a broken
  // stream rather than a 400.
  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream<ChatUIMessage>({
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
        // Fires once the model has finished, including when the reader pressed
        // Stop — a partial answer is still what they were shown, so it is still
        // what the transcript should say.
        onFinish: ({ text }) => persist(text, sources),
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
