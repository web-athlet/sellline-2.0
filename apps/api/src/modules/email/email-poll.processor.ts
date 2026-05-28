import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { EMAIL_POLL_QUEUE, EmailSyncService } from './email-sync.service';

@Processor(EMAIL_POLL_QUEUE)
export class EmailPollProcessor extends WorkerHost {
  constructor(private readonly sync: EmailSyncService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    await this.sync.pollAllUsers();
  }
}
