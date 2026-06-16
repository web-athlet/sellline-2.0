import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeadsController } from './leads.controller';
import { LeadsService, LEAD_ENRICHMENT_QUEUE } from './leads.service';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    // Session 14: 3 retries with exponential backoff; failed jobs retained as the DLQ.
    BullModule.registerQueue({
      name: LEAD_ENRICHMENT_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
