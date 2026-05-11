-- Partial unique index: only one active Person can own a given primary email.
-- Soft-deleted persons (deletedAt IS NOT NULL) are excluded, allowing re-use after hard-delete.
CREATE UNIQUE INDEX "persons_active_email_unique"
  ON "Person" ((emails[1]))
  WHERE "deletedAt" IS NULL;
