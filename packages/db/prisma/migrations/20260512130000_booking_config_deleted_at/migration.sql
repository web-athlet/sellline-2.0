-- B-3 Fix: DSGVO soft-delete support for BookingConfig

ALTER TABLE "BookingConfig" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "BookingConfig_deletedAt_idx" ON "BookingConfig"("deletedAt");
