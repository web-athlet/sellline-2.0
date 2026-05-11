import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [DealsController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
