import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CampaignSendProcessor } from './campaign-send.processor';
import { CampaignTrackingController } from './campaign-tracking.controller';
import { CampaignsController } from './campaigns.controller';
import { CAMPAIGN_SEND_QUEUE, CampaignsService } from './campaigns.service';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: CAMPAIGN_SEND_QUEUE })],
  controllers: [CampaignsController, CampaignTrackingController],
  providers: [CampaignsService, CampaignSendProcessor],
  exports: [CampaignsService],
})
export class CampaignsModule {}
