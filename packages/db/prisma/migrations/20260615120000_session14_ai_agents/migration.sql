-- Session 14 — KI-Agenten (Enrichment, Scoring, Ghosting) + earmarked tech-debt P6/D1.

-- Lead: rule-based scoring maintained by the Scoring-Worker.
ALTER TABLE "Lead" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "scoreUpdatedAt" TIMESTAMP(3);

-- Deal: ghosting flag set by the daily Ghosting-Detector cron.
ALTER TABLE "Deal" ADD COLUMN "ghostedAt" TIMESTAMP(3);

-- AIInsight: soft-delete (Deep-Review Tech-Debt D1).
ALTER TABLE "AIInsight" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Indexes (Prisma naming convention <Table>_<column>_idx).
CREATE INDEX "Lead_score_idx" ON "Lead"("score");
CREATE INDEX "Deal_ghostedAt_idx" ON "Deal"("ghostedAt");
CREATE INDEX "AIInsight_deletedAt_idx" ON "AIInsight"("deletedAt");

-- P6: HNSW approximate-nearest-neighbour index for Organization enrichment
-- embeddings (pgvector). Not expressible in the Prisma schema (Unsupported type),
-- so applied as raw SQL. Cosine distance matches text-embedding-3-small usage.
CREATE INDEX IF NOT EXISTS "Organization_enrichmentEmbedding_hnsw"
  ON "Organization" USING hnsw ("enrichmentEmbedding" vector_cosine_ops);
