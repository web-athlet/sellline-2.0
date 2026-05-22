import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { EMAIL_SYNC_QUEUE, EmailSyncService } from './email-sync.service';

@Processor(EMAIL_SYNC_QUEUE)
export class EmailSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailSyncProcessor.name);

  constructor(private readonly sync: EmailSyncService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { type } = job.data as { type: string };

    switch (type) {
      case 'gmail':
        await this.sync.syncFromGmailHistory(job.data.emailAddress, job.data.historyId);
        break;
      case 'outlook':
        await this.sync.fetchAndStoreOutlookMessage(job.data.userId, job.data.messageId);
        break;
      case 'renew-watches':
        await this.sync.renewExpiredWatches();
        await this.sync.renewExpiredOutlookSubscriptions();
        break;
      default:
        this.logger.warn(`Unknown job type: ${type}`);
    }
  }
}
