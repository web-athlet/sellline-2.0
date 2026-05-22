-- Session 11: Email.userId FK + User.outlook subscription fields

-- Email → User FK (Tech-Debt #5 for Email, analogous to Task.assigneeId in Session 10)
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Outlook subscription tracking for watch-renewal cron
ALTER TABLE "User" ADD COLUMN "outlookSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "outlookSubscriptionExpiresAt" TIMESTAMP(3);

-- Indexes for email-related queries (P2 from Deep-Review backlog)
CREATE INDEX IF NOT EXISTS "Email_userId_deletedAt_idx" ON "Email"("userId", "deletedAt");
CREATE INDEX IF NOT EXISTS "User_gmailWatchExpiresAt_idx" ON "User"("gmailWatchExpiresAt");
