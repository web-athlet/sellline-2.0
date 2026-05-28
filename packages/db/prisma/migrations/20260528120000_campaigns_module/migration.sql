-- AlterTable: add Campaign.previewText
ALTER TABLE "Campaign" ADD COLUMN "previewText" TEXT;

-- AlterTable: add Person.optOutAt (Tech-Debt D3 from Session 1 deep review)
ALTER TABLE "Person" ADD COLUMN "optOutAt" TIMESTAMP(3);

-- AlterTable: add CampaignContact.sentAt for send-status tracking
ALTER TABLE "CampaignContact" ADD COLUMN "sentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CampaignContact_campaignId_sentAt_idx" ON "CampaignContact"("campaignId", "sentAt");

-- DropForeignKey: CampaignContact → Campaign (RESTRICT → CASCADE, Tech-Debt D4)
ALTER TABLE "CampaignContact" DROP CONSTRAINT "CampaignContact_campaignId_fkey";

-- DropForeignKey: CampaignContact → Person (RESTRICT → CASCADE, Tech-Debt D4)
ALTER TABLE "CampaignContact" DROP CONSTRAINT "CampaignContact_personId_fkey";

-- AddForeignKey (with CASCADE)
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (with CASCADE)
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
