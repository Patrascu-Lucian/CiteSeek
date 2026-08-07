-- Hand-edited: drizzle-kit emitted one `ADD COLUMN ... NOT NULL`, which fails on
-- a table that already has rows. Regenerating this file loses the backfill.
ALTER TABLE "chunks" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
UPDATE "chunks" SET "workspace_id" = "documents"."workspace_id" FROM "documents" WHERE "chunks"."document_id" = "documents"."id";--> statement-breakpoint
ALTER TABLE "chunks" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_workspace_id_idx" ON "chunks" USING btree ("workspace_id");
