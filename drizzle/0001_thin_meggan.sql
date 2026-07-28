ALTER TABLE "documents" ADD COLUMN "content_text" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "page_spans" jsonb;