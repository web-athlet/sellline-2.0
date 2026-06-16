-- Session 15 — Security & DSGVO-Härtung.
-- Account-lockout tracking for brute-force protection (Block 10).

ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" TIMESTAMP(3);
