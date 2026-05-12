import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PulseFeedModule } from '../pulse-feed/pulse-feed.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService, DEAL_SCORING_QUEUE } from './activities.service';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    PulseFeedModule,
    BullModule.registerQueue({ name: DEAL_SCORING_QUEUE }),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
