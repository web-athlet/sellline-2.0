import { Inject, Injectable, Logger } from '@nestjs/common';
import { EnrichmentStatus, Prisma } from '@nextgen/db';
import { addDays } from 'date-fns';
import type OpenAI from 'openai';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_INSIGHT_TYPE, GENERIC_EMAIL_DOMAINS } from '../ai.constants';
import { estimateRunCostUsd } from '../cost/cost.util';
import { OPENAI_CLIENT } from '../openai.provider';
import { ENRICHMENT_SYSTEM, ENRICHMENT_USER } from '../prompts/enrichment';
import { ScoringService } from '../scoring/scoring.service';
import {
  countFilledFields,
  EnrichmentCost,
  EnrichmentFields,
  normalizeFields,
} from './enrichment.types';
import { SerperClient, SerperQuotaError, SerperResult } from './serper.client';
import { WebScraper } from './web-scraper';

const ZERO_COST: EnrichmentCost = {
  serperCredits: 0,
  openaiTokensIn: 0,
  openaiTokensOut: 0,
  estCostUsd: 0,
};

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly serper: SerperClient,
    private readonly scraper: WebScraper,
    private readonly scoring: ScoringService,
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI | null,
  ) {}

  /**
   * Enrichment pipeline for a single lead. Always resolves (a "partial" outcome is a
   * success, not a failure) so the lead is passed through even when Serper/OpenAI are
   * unavailable. Throwing only happens on unexpected errors → BullMQ retries.
   */
  async enrich(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
    });
    if (!lead) {
      this.logger.warn(`enrich: lead ${leadId} not found`);
      return;
    }
    if (lead.convertedDealId) {
      this.logger.debug(`enrich: lead ${leadId} already converted, skipping`);
      return;
    }

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { enrichmentStatus: EnrichmentStatus.PROCESSING },
    });

    const domain =
      lead.emailDomain && !GENERIC_EMAIL_DOMAINS.has(lead.emailDomain.toLowerCase())
        ? lead.emailDomain.toLowerCase()
        : null;
    const query = [lead.companyName, domain].filter(Boolean).join(' ').trim();
    if (!query) {
      return this.finalizePartial(leadId, 'no_company_signal', ZERO_COST);
    }

    // 1. Serper search — fall back gracefully on quota / empty / unconfigured.
    let results: SerperResult[];
    try {
      results = await this.serper.search(query, 5);
    } catch (err) {
      if (err instanceof SerperQuotaError) {
        this.logger.warn(`enrich: Serper quota exhausted for lead ${leadId}`);
        return this.finalizePartial(leadId, 'serper_quota', ZERO_COST);
      }
      throw err; // unexpected → let BullMQ retry
    }
    if (results.length === 0) {
      return this.finalizePartial(leadId, 'serper_empty', { ...ZERO_COST, serperCredits: 1 });
    }

    // 2. Scrape top-3 URLs (robots.txt respected inside the scraper).
    const scraped: string[] = [];
    for (const url of results
      .slice(0, 3)
      .map((r) => r.link)
      .filter(Boolean)) {
      const text = await this.scraper.fetchAllowedText(url);
      if (text) scraped.push(text);
    }
    const snippets = [...results.map((r) => r.snippet).filter(Boolean), ...scraped];

    // 3. GPT-4o extraction (structured JSON).
    if (!this.openai) {
      return this.finalizePartial(leadId, 'openai_not_configured', {
        ...ZERO_COST,
        serperCredits: 1,
      });
    }

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      temperature: 0.2,
      messages: [
        { role: 'system', content: ENRICHMENT_SYSTEM },
        { role: 'user', content: ENRICHMENT_USER(snippets) },
      ],
    });

    const tokensIn = completion.usage?.prompt_tokens ?? 0;
    const tokensOut = completion.usage?.completion_tokens ?? 0;
    const fields = normalizeFields(JSON.parse(completion.choices[0]?.message?.content ?? '{}'));
    const confidence = Math.round((countFilledFields(fields) / 7) * 100) / 100;
    const cost: EnrichmentCost = {
      serperCredits: 1,
      openaiTokensIn: tokensIn,
      openaiTokensOut: tokensOut,
      estCostUsd: estimateRunCostUsd({
        serperCredits: 1,
        openaiTokensIn: tokensIn,
        openaiTokensOut: tokensOut,
      }),
    };

    // 4. Persist: Organization (by domain), Lead.enrichedJson, AIInsight.
    const orgId = await this.persistOrganization(domain, lead.companyName, fields, snippets);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichedJson: { fields, confidence, cost, orgId } as unknown as Prisma.InputJsonValue,
        enrichmentStatus: EnrichmentStatus.DONE,
      },
    });

    await this.prisma.aIInsight.create({
      data: {
        type: AI_INSIGHT_TYPE.ENRICHMENT,
        content: {
          leadId,
          orgId,
          fields,
          confidence,
          status: 'complete',
          cost,
        } as unknown as Prisma.InputJsonValue,
        validUntil: addDays(new Date(), 30),
      },
    });

    this.events.emitLeadEnriched({ leadId, status: 'DONE', ts: Date.now() });
    await this.scoring.enqueue(leadId);
  }

  /**
   * Called by the processor when a job exhausts all retries (dead-letter). Marks the
   * lead FAILED, records the error as an AIInsight and notifies via log/event. The
   * failed BullMQ job itself is retained (removeOnFail) as the de-facto DLQ.
   */
  async handleDeadLetter(leadId: string, message: string): Promise<void> {
    this.logger.error(`enrichment dead-letter for lead ${leadId}: ${message}`);
    await this.prisma.lead
      .update({ where: { id: leadId }, data: { enrichmentStatus: EnrichmentStatus.FAILED } })
      .catch((err) => this.logger.warn(`dead-letter lead update failed: ${String(err)}`));
    await this.prisma.aIInsight
      .create({
        data: {
          type: AI_INSIGHT_TYPE.ENRICHMENT,
          content: { leadId, status: 'failed', error: message } as unknown as Prisma.InputJsonValue,
          validUntil: addDays(new Date(), 30),
        },
      })
      .catch((err) => this.logger.warn(`dead-letter insight create failed: ${String(err)}`));
    this.events.emitLeadEnriched({ leadId, status: 'FAILED', ts: Date.now() });
  }

  /** Pass the lead through without full enrichment: log a partial AIInsight, still score. */
  private async finalizePartial(
    leadId: string,
    reason: string,
    cost: EnrichmentCost,
  ): Promise<void> {
    await this.prisma.aIInsight.create({
      data: {
        type: AI_INSIGHT_TYPE.ENRICHMENT,
        content: { leadId, status: 'partial', reason, cost } as unknown as Prisma.InputJsonValue,
        validUntil: addDays(new Date(), 30),
      },
    });
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        enrichmentStatus: EnrichmentStatus.DONE,
        enrichedJson: { status: 'partial', reason } as unknown as Prisma.InputJsonValue,
      },
    });
    this.events.emitLeadEnriched({ leadId, status: 'DONE', ts: Date.now() });
    await this.scoring.enqueue(leadId);
  }

  /** Upsert the Organization (keyed by unique domain) with the extracted fields. */
  private async persistOrganization(
    domain: string | null,
    companyName: string | null,
    fields: EnrichmentFields,
    snippets: string[],
  ): Promise<string | null> {
    if (!domain) return null;

    // Plain (inferred) value object — assignable to both the update and create inputs.
    const orgFields = {
      industry: fields.branche ?? undefined,
      employeeCount: fields.mitarbeiterzahl ?? undefined,
      revenue: fields.jahresumsatz != null ? String(fields.jahresumsatz) : undefined,
      linkedinUrl: fields.socialProfiles.linkedin ?? undefined,
      enrichedAt: new Date(),
      enrichedJson: fields as unknown as Prisma.InputJsonValue,
    };

    const org = await this.prisma.organization.upsert({
      where: { domain },
      update: orgFields,
      create: {
        name: companyName ?? domain,
        domain,
        website: `https://${domain}`,
        ...orgFields,
      },
    });

    await this.storeEmbedding(org.id, [companyName, fields.branche, ...snippets].join(' '));
    return org.id;
  }

  /** Best-effort pgvector embedding write (powers the HNSW similarity index). Never fatal. */
  private async storeEmbedding(orgId: string, text: string): Promise<void> {
    if (!this.openai) return;
    try {
      const emb = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8_000),
      });
      const vector = emb.data[0]?.embedding;
      if (!vector?.length) return;
      await this.prisma.$executeRawUnsafe(
        `UPDATE "Organization" SET "enrichmentEmbedding" = $1::vector WHERE id = $2`,
        `[${vector.join(',')}]`,
        orgId,
      );
    } catch (err) {
      this.logger.debug(`embedding write skipped for org ${orgId}: ${String(err)}`);
    }
  }
}
