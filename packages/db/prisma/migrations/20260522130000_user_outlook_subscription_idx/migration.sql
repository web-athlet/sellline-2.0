-- P3: index for webhook lookup by outlookSubscriptionId (findFirst per notification)
CREATE INDEX IF NOT EXISTS "User_outlookSubscriptionId_idx" ON "User"("outlookSubscriptionId");

-- P4: index for renewal cron filtering by outlookSubscriptionExpiresAt (asymmetric with gmailWatchExpiresAt_idx)
CREATE INDEX IF NOT EXISTS "User_outlookSubscriptionExpiresAt_idx" ON "User"("outlookSubscriptionExpiresAt");
