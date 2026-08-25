-- Hand-written: there is no schema change to diff. ADR 040 made the demo
-- unwritable and this release stopped listing its chats, which left rows nobody
-- can reach still counting against their owner's three-conversation cap.
-- Messages cascade from `chats`, so this is the whole cleanup.
DELETE FROM "chats" USING "workspaces" WHERE "chats"."workspace_id" = "workspaces"."id" AND "workspaces"."is_demo";
