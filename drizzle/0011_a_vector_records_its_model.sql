-- Hand-edited: the UPDATE labels vectors stored before the column existed, and
-- regenerating this file loses it. A row is labeled only when sign and sparsity
-- agree (ADR 062); any other row stays null, unsearchable and repairable.
ALTER TABLE "chunks" ADD COLUMN "embedding_model" text;--> statement-breakpoint
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
WHERE c.id = s.id AND s.model IS NOT NULL;
