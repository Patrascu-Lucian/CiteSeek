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

/* ---------------------------------------------------------------------------
 * Auth.js tables
 *
 * These five column shapes are dictated by @auth/drizzle-adapter, which reads
 * properties by name (`refresh_token`, not `refreshToken`). They are copied from
 * the adapter's own type definitions rather than from memory -- a mismatch here
 * fails at runtime during sign-in, not at compile time.
 * ------------------------------------------------------------------------- */

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

/**
 * Ingestion is a background job, so a document's state has to be readable from
 * the database rather than inferred from whether a request is still open. These
 * are the states the documents list renders -- including the failure state,
 * which needs to be visible and retryable rather than silently absent.
 */
export const documentStatus = pgEnum("document_status", [
  "queued",
  "processing",
  "ready",
  "failed",
]);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);

/**
 * Page boundaries within a document's extracted text. Mirrors `PageSpan` in
 * `lib/rag/normalize.ts`; declared here so the schema does not depend on the
 * RAG layer, and asserted equal to it by a type test.
 */
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
    /**
     * Null for the seeded demo workspace, which belongs to no one. Guest
     * sessions read it; nothing writes to it. Keeping ownership nullable is
     * what lets authorization be a single rule ("you own it, or it is the demo
     * and you are read-only") instead of a special case threaded everywhere.
     */
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
    /**
     * Populated only when status is 'failed'; surfaced in the UI, not swallowed.
     * Sanitized before storage -- an exception message, never document text.
     */
    error: text("error"),
    /**
     * The canonical extracted text. Every `chunks.charStart` / `charEnd` indexes
     * into this exact string, so a citation is a substring slice of it.
     *
     * The uploaded file itself is discarded after parsing: keeping only text
     * means erasure is one SQL delete with no orphaned blobs, and there is no
     * second data location to reason about under GDPR.
     */
    contentText: text("content_text"),
    /**
     * Where each page begins and ends within `contentText`. Null for formats
     * with no page concept (docx, markdown, plain text).
     *
     * Persisted rather than recomputed because the original bytes are gone --
     * adding this column later would require re-uploading every document, which
     * makes it effectively one-way.
     */
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
    /**
     * 768 dimensions, not the model default of 3072: pgvector's HNSW and IVFFlat
     * indexes cap the `vector` type at 2000. See
     * docs/decisions/002-embedding-model-and-dimension.md.
     */
    embedding: vector("embedding", { dimensions: 768 }),
    /**
     * Citation anchors. These are the whole point of the product -- without the
     * page and character span there is no way to open a source document scrolled
     * to the passage an answer came from, so they are stored at ingestion time
     * rather than recomputed later.
     */
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
    /**
     * HNSW over cosine distance. Cosine because the embeddings are normalized and
     * we care about direction, not magnitude. Built now that the dimension is
     * settled; on an empty table this is free, and adding it later would mean a
     * migration that rebuilds over every row.
     */
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

/**
 * Why an answer could not be grounded.
 *
 * Only the two cases the route can tell apart without a model. Anything
 * finer-grained would be a guess about what the reader meant, and the whole
 * design rests on a refusal being a fact about retrieval rather than an
 * interpretation of the question. See ADR 017.
 */
export type RefusalReason =
  /** Passages exist in this workspace; none of them cleared the relevance floor. */
  | "no_relevant_passages"
  /** Nothing has finished processing, so there was nothing to search at all. */
  | "no_documents";

/**
 * One citation as stored on a message. Chunk ids are kept alongside a snapshot of
 * the anchor so a rendered answer stays readable even if the source document is
 * later deleted -- a dangling citation should degrade, not crash the transcript.
 */
export type MessageCitation = {
  chunkId: string;
  documentId: string;
  /**
   * Part of the snapshot, not a join. A chip has to be able to name its source
   * even after the document is deleted, and reading the name live would also let
   * a rename silently rewrite what an old answer appears to have cited.
   */
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
    /**
     * Position within the conversation, for the same reason `chunks` carries
     * `chunkIndex`: `created_at` defaults to `now()`, which is the *transaction*
     * timestamp, so every row written by one statement shares it. A turn inserts
     * the question and the answer together, leaving the tiebreak to a random
     * UUIDv4 primary key — which rendered transcripts in arbitrary order.
     */
    position: integer("position").notNull(),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    /** Empty array for user messages; populated for grounded assistant answers. */
    citations: jsonb("citations")
      .$type<MessageCitation[]>()
      .default([])
      .notNull(),
    /**
     * Why this turn could not be grounded, or null if it was.
     *
     * Stored rather than derived. The alternative was comparing `content`
     * against the fixed refusal sentence, which breaks silently the moment that
     * sentence is reworded — and a refusal that loses its reason renders as bare
     * text on the next visit, which is the bug this column exists to prevent.
     *
     * Deliberately a plain string rather than a pg enum: the set of reasons is
     * application logic that will grow, and widening an enum needs a migration
     * while widening a union does not. Nothing in SQL branches on this value.
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
 * What was spent, and by whom.
 *
 * Append-only, and the source of truth for three different questions asked at
 * three different scales: requests in the last minute (the rate limit), tokens
 * today for one caller (the personal cap), tokens today across everyone (the
 * global cap protecting the shared Gemini quota). One table rather than three
 * counters because the questions are all `where actor = ? and created_at > ?`
 * over the same rows, and because Milestone 4's usage dashboard is a fourth
 * question over the same data.
 *
 * Rows are pruned on a retention window rather than kept forever — see
 * `lib/usage/queries.ts`. Nothing here is needed once it is older than the
 * longest window any cap looks back over.
 */
export const usageKind = pgEnum("usage_kind", ["chat", "embedding"]);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /**
     * Who spent it. A guest's id comes from a cookie they can clear, so it is
     * recorded for reading rather than relied on for limiting — `ipHash` is the
     * key that actually constrains a guest.
     */
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),

    /**
     * `HMAC-SHA256(clientIp, AUTH_SECRET)`, never the address itself.
     *
     * Equality on the hash counts identically to equality on the address, so
     * nothing about enforcement changes, and the table never holds an IP.
     * Rotating `AUTH_SECRET` re-keys every hash and so resets every limit —
     * acceptable, and the same trade already made for guest cookies.
     */
    ipHash: text("ip_hash"),

    /** Nullable: a request refused before authorization has no workspace yet. */
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),

    kind: usageKind("kind").notNull(),

    /**
     * Almost always 1. Kept as a column rather than counting rows so a future
     * batched write stays expressible without a migration.
     */
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
