-- Session 5 (M3 Deals): add Deal.order for in-stage DnD sort key, Deal.score
-- (set by deal-scoring worker in Session 14), and Deal.closingDate (expected
-- close date — distinct from closedAt which is the actual close timestamp).
ALTER TABLE "Deal"
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "closingDate" TIMESTAMP(3);

-- Composite index keeps Kanban column queries (stageId+order) fast.
CREATE INDEX "Deal_stageId_order_idx" ON "Deal" ("stageId", "order");
