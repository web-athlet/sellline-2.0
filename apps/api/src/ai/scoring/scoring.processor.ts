import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LEAD_SCORING_QUEUE } from '../ai.constants';
import { ScoringService } from './scoring.service';

@Processor(LEAD_SCORING_QUEUE)
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(private readonly scoring: ScoringService) {
    super();
  }

  async process(job: Job<{ leadId: string }>): Promise<void> {
    await this.scoring.score(job.data.leadId);
  }
}
