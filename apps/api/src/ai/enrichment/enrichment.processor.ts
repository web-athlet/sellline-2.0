import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LEAD_ENRICHMENT_QUEUE } from '../ai.constants';
import { EnrichmentService } from './enrichment.service';

interface EnrichJobData {
  leadId: string;
}

@Processor(LEAD_ENRICHMENT_QUEUE)
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(private readonly enrichment: EnrichmentService) {
    super();
  }

  async process(job: Job<EnrichJobData>): Promise<void> {
    await this.enrichment.enrich(job.data.leadId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<EnrichJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const attempts = job.opts?.attempts ?? 1;
    this.logger.error(
      `enrichment job ${job.id} failed (attempt ${job.attemptsMade}/${attempts}): ${err.message}`,
    );
    if (job.attemptsMade >= attempts) {
      await this.enrichment.handleDeadLetter(job.data.leadId, err.message);
    }
  }
}
