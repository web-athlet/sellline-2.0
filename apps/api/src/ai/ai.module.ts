import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { LEAD_ENRICHMENT_QUEUE, LEAD_SCORING_QUEUE } from './ai.constants';
import { CostService } from './cost/cost.service';
import { EnrichmentProcessor } from './enrichment/enrichment.processor';
import { EnrichmentService } from './enrichment/enrichment.service';
import { SerperClient } from './enrichment/serper.client';
import { WebScraper } from './enrichment/web-scraper';
import { GhostingService } from './ghosting/ghosting.service';
import { openAiProvider } from './openai.provider';
import { ScoringProcessor } from './scoring/scoring.processor';
import { ScoringService } from './scoring/scoring.service';

// Session 14 — KI-Agenten. Consumes the existing `lead-enrichment` queue (producer:
// LeadsService) and owns the new `lead-scoring` queue. Ghosting + Cost run on @Cron.
@Module({
  imports: [
    PrismaModule,
    EventsModule,
    BullModule.registerQueue({ name: LEAD_ENRICHMENT_QUEUE }),
    BullModule.registerQueue({ name: LEAD_SCORING_QUEUE }),
  ],
  providers: [
    openAiProvider,
    SerperClient,
    WebScraper,
    EnrichmentService,
    EnrichmentProcessor,
    ScoringService,
    ScoringProcessor,
    GhostingService,
    CostService,
  ],
  exports: [EnrichmentService, ScoringService, GhostingService, CostService],
})
export class AiModule {}
