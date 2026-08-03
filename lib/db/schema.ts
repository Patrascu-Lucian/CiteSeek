import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/* Auth.js tables. Column names are dictated by @auth/drizzle-adapter, which reads
 * them by name (`refresh_token`, not `refreshToken`); a mismatch fails at
 * sign-in, not at compile time. */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

/* ---------------------------------------------------------------------------
 * Application tables
 * ------------------------------------------------------------------------- */

/** Ingestion is a background job, so state lives in the row rather than in an
 * open request. `failed` is visible and retryable, not swallowed. */
export const documentStatus = pgEnum("document_status", [
  "queued",
  "processing",
  "ready",
  "failed",
]);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);

/** Mirrors `PageSpan` in `lib/rag/normalize.ts` — duplicated so the schema does
 * not depend on the RAG layer, and asserted equal by a type test. */
export type DocumentPageSpan = {
  pageNumber: number;
  charStart: number;
  charEnd: number;
};

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** Null for the demo workspace, which belongs to no one. Nullable ownership
     * keeps authorization one rule instead of a threaded special case. */
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    isDemo: boolean("is_demo").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workspaces_owner_id_idx").on(table.ownerId),
    // At most one demo workspace. A partial unique index expresses "only one row
    // may have is_demo = true" without a separate table or an application check.
    uniqueIndex("workspaces_single_demo_idx")
      .on(table.isDemo)
      .where(sql`${table.isDemo}`),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: documentStatus("status").default("queued").notNull(),
    /** Sanitized before storage: an exception message, never document text. */
    error: text("error"),
    /**
     * Canonical text. Every `chunks.charStart`/`charEnd` indexes into this exact
     * string, so a citation is a slice of it. The uploaded file is discarded
     * after parsing — erasure is one DELETE with no orphaned blobs (ADR 009).
     */
    contentText: text("content_text"),
    /** Null for formats with no pages. Persisted rather than recomputed: the
     * original bytes are gone, so adding this later means re-uploading. */
    pageSpans: jsonb("page_spans").$type<DocumentPageSpan[]>(),
    pageCount: integer("page_count"),
    chunkCount: integer("chunk_count"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("documents_workspace_id_idx").on(table.workspaceId)],
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    /** Position within the document, so retrieved chunks can be re-ordered and neighbors fetched. */
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    /** 768, not the model default 3072: pgvector's HNSW/IVFFlat cap `vector` at
     * 2000. See ADR 002. */
    embedding: vector("embedding", { dimensions: 768 }),
    /** Citation anchors, stored at ingestion. Without the page and span there is
     * no way to open a source at the passage an answer came from. */
    pageNumber: integer("page_number"),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chunks_document_id_idx").on(table.documentId),
    uniqueIndex("chunks_document_id_chunk_index_idx").on(
      table.documentId,
      table.chunkIndex,
    ),
    /** HNSW over cosine — embeddings are normalized, so direction is what
     * matters. Built on an empty table; later means rebuilding every row. */
    index("chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Null for guest chats, which are not tied to an account. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chats_workspace_id_idx").on(table.workspaceId),
    /*
      The conversation list's exact query: this user's chats in this workspace,
      newest first. `chats_workspace_id_idx` alone leaves the user filter and the
      sort to be done by scanning, which is invisible while a workspace holds a
      handful of chats and is the kind of thing found much later, under data
      nobody has yet.

      `updated_at` descending because that is the order the list is read in, and
      a matching index direction lets the sort be satisfied by the scan rather
      than performed after it.
    */
    index("chats_workspace_user_updated_idx").on(
      table.workspaceId,
      table.userId,
      table.updatedAt.desc(),
    ),
  ],
);

/** Only the two cases the route can distinguish without a model — a refusal is a
 * fact about retrieval, not an interpretation of the question. ADR 017. */
export type RefusalReason =
  /** Passages exist in this workspace; none of them cleared the relevance floor. */
  | "no_relevant_passages"
  /** Nothing has finished processing, so there was nothing to search at all. */
  | "no_documents";

/** Chunk id plus a snapshot of the anchor, so a dangling citation degrades
 * rather than crashing the transcript when its document is deleted. */
export type MessageCitation = {
  chunkId: string;
  documentId: string;
  /** Snapshot, not a join: a chip must name its source after deletion, and a live
   * read would let a rename rewrite what an old answer cited. */
  filename: string;
  pageNumber: number | null;
  charStart: number;
  charEnd: number;
  quote: string;
};

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    /** `created_at` is the *transaction* timestamp, so both rows of a turn share
     * it and the tiebreak falls to a random UUIDv4 — transcripts came out in
     * arbitrary order. */
    position: integer("position").notNull(),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations")
      .$type<MessageCitation[]>()
      .default([])
      .notNull(),
    /**
     * Why this turn could not be grounded, or null if it was. Stored rather than
     * derived from `content`, which would break the moment the refusal sentence
     * is reworded. A plain string rather than a pg enum because widening a union
     * needs no migration and nothing in SQL branches on it.
     */
    refusalReason: text("refusal_reason").$type<RefusalReason>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_chat_id_idx").on(table.chatId),
    // Unique, so a concurrent append fails loudly rather than silently
    // duplicating a position and reordering the transcript.
    uniqueIndex("messages_chat_id_position_idx").on(
      table.chatId,
      table.position,
    ),
  ],
);

/* ---------------------------------------------------------------------------
 * Inferred types -- the single source of truth for row shapes across the app.
 * ------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentStatus = (typeof documentStatus.enumValues)[number];
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

/**
 * What was spent, and by whom. Append-only, and the source for four questions at
 * different scales — the rate limit, the personal cap, the global cap, and the
 * usage dashboard — all of which are `where actor = ? and created_at > ?` over
 * the same rows. Pruned on a retention window; see `lib/usage/queries.ts`.
 */
export const usageKind = pgEnum("usage_kind", ["chat", "embedding"]);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** A guest's id comes from a clearable cookie, so it is recorded for reading;
     * `ipHash` is what actually constrains them. */
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),

    /** `HMAC-SHA256(clientIp, AUTH_SECRET)`. Equality on the hash counts the same
     * as on the address, so the table never holds an IP. Rotating the secret
     * resets every limit — the trade guest cookies already make. */
    ipHash: text("ip_hash"),

    /** Nullable: a request refused before authorization has no workspace yet. */
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),

    kind: usageKind("kind").notNull(),

    /** Almost always 1; a column rather than a row count so a batched write stays
     * expressible without a migration. */
    requests: integer("requests").default(1).notNull(),

    /** Embedding spend lands in `inputTokens`; it produces no output tokens. */
    inputTokens: integer("input_tokens").default(0).notNull(),
    outputTokens: integer("output_tokens").default(0).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // The three queries the caps run, in the order they run them. Each is a
    // range scan over a time window, so the timestamp is the trailing column.
    index("usage_events_actor_idx").on(table.actorId, table.createdAt),
    index("usage_events_ip_hash_idx").on(table.ipHash, table.createdAt),
    index("usage_events_created_at_idx").on(table.createdAt),
  ],
);
