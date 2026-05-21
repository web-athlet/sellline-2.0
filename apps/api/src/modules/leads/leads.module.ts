import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { LeadsController } from './leads.controller';
import { LeadsService, LEAD_ENRICHMENT_QUEUE } from './leads.service';

@Module({
  imports: [PrismaModule, EventsModule, BullModule.registerQueue({ name: LEAD_ENRICHMENT_QUEUE })],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
