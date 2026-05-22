import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailWebhooksController } from './email-webhooks.controller';
import { EmailController } from './email.controller';
import { EmailPollProcessor } from './email-poll.processor';
import { EmailSyncProcessor } from './email-sync.processor';
import { EMAIL_POLL_QUEUE, EMAIL_SYNC_QUEUE, EmailSyncService } from './email-sync.service';
import { EmailService } from './email.service';

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    BullModule.registerQueue({ name: EMAIL_SYNC_QUEUE }),
    BullModule.registerQueue({ name: EMAIL_POLL_QUEUE }),
  ],
  controllers: [EmailController, EmailWebhooksController],
  providers: [EmailService, EmailSyncService, EmailSyncProcessor, EmailPollProcessor],
  exports: [EmailService, EmailSyncService],
})
export class EmailModule {}
