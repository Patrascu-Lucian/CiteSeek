-- Hand-edited, and regenerating this file loses it: 0011's UPDATE again, verbatim,
-- for anything stored unlabeled since, then a refusal that says what to do if a
-- vector and its model still disagree, ahead of the constraint (ADR 062).
UPDATE "chunks" AS c SET "embedding_model" = s.model
FROM (
  SELECT id, CASE
      WHEN count(*) FILTER (WHERE x < 0) > 0 AND count(*) FILTER (WHERE x = 0) = 0
        THEN 'gemini-embedding-001'
      WHEN count(*) FILTER (WHERE x < 0) = 0 AND count(*) FILTER (WHERE x = 0) > 0
        THEN 'fake'
    END AS model
  FROM "chunks", unnest("embedding"::real[]) AS x
  WHERE "embedding" IS NOT NULL AND "embedding_model" IS NULL
  GROUP BY id
) AS s
WHERE c.id = s.id AND s.model IS NOT NULL;--> statement-breakpoint
DO $$
DECLARE
  disagreeing bigint;
BEGIN
  SELECT count(*) INTO disagreeing FROM "chunks"
  WHERE ("embedding" IS NULL) <> ("embedding_model" IS NULL);
  IF disagreeing > 0 THEN
    RAISE EXCEPTION '% chunk(s) hold a vector without its model, or a model without a vector. Label or re-embed them (pnpm db:reembed lists the vectors), then migrate again.', disagreeing;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_embedding_and_model_together" CHECK (("chunks"."embedding" IS NULL) = ("chunks"."embedding_model" IS NULL));
