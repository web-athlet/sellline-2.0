import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { PulseFeedController } from './pulse-feed.controller';
import { PulseFeedService } from './pulse-feed.service';

@Module({
  imports: [PrismaModule, RedisModule, EventsModule],
  controllers: [PulseFeedController],
  providers: [PulseFeedService],
  exports: [PulseFeedService],
})
export class PulseFeedModule {}
