ALTER TABLE "messages" ADD COLUMN "position" integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_chat_id_position_idx" ON "messages" USING btree ("chat_id","position");