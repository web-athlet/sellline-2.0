import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma, Role } from '@nextgen/db';
import { Queue } from 'bullmq';
import { addDays, differenceInDays } from 'date-fns';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_INSIGHT_TYPE, LEAD_SCORING_QUEUE } from '../ai.constants';
import type { EnrichmentFields } from '../enrichment/enrichment.types';
import { calculateLeadScore, ScoringInput } from './scoring.rules';

const SCORE_DEBOUNCE_MS = 30_000;
const AUTO_CONVERT_THRESHOLD = 80;

function extractString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    if (typeof data[k] === 'string' && (data[k] as string).length > 0) return data[k] as string;
  }
  return undefined;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    @InjectQueue(LEAD_SCORING_QUEUE) private readonly queue: Queue,
  ) {}

  /** Debounced enqueue: a newer trigger replaces the pending delayed job (latest wins). */
  async enqueue(leadId: string): Promise<void> {
    const jobId = `score-${leadId}`;
    await this.queue.remove(jobId).catch(() => undefined);
    await this.queue.add(
      'score',
      { leadId },
      { delay: SCORE_DEBOUNCE_MS, jobId, removeOnComplete: true },
    );
  }

  private get autoConvertEnabled(): boolean {
    const v = process.env.AI_AUTO_CONVERT_ENABLED;
    return v === 'true' || v === '1';
  }

  async score(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
    if (!lead) {
      this.logger.warn(`score: lead ${leadId} not found`);
      return;
    }

    const data = (lead.dataJson ?? {}) as Record<string, unknown>;
    const email = extractString(data, ['email', 'e-mail', 'Email']);
    const phone = extractString(data, ['phone', 'tel', 'telefon', 'mobile']);
    const fields =
      ((lead.enrichedJson ?? {}) as { fields?: Partial<EnrichmentFields> }).fields ?? {};

    const input: ScoringInput = {
      fit: {
        employeeCount: typeof fields.mitarbeiterzahl === 'number' ? fields.mitarbeiterzahl : null,
        industry: typeof fields.branche === 'string' ? fields.branche : null,
        revenue: typeof fields.jahresumsatz === 'number' ? fields.jahresumsatz : null,
      },
      engagement: await this.engagementFor(email),
      recencyDays: differenceInDays(new Date(), lead.updatedAt),
      profile: { hasEmail: !!email, hasPhone: !!phone, hasWebsite: !!lead.emailDomain },
    };

    const breakdown = calculateLeadScore(input);

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { score: breakdown.total, scoreUpdatedAt: new Date() },
    });
    await this.prisma.aIInsight.create({
      data: {
        type: AI_INSIGHT_TYPE.SCORING,
        content: { leadId, score: breakdown.total, breakdown } as unknown as Prisma.InputJsonValue,
        validUntil: addDays(new Date(), 30),
      },
    });

    if (
      breakdown.total >= AUTO_CONVERT_THRESHOLD &&
      this.autoConvertEnabled &&
      !lead.convertedDealId
    ) {
      await this.autoConvert(lead, breakdown.total, email, phone);
    }
  }

  /** Engagement = campaign opens/clicks of a Person whose emails include the lead email. */
  private async engagementFor(email?: string): Promise<{ opens: number; clicks: number }> {
    if (!email) return { opens: 0, clicks: 0 };
    const person = await this.prisma.person.findFirst({
      where: { emails: { has: email }, deletedAt: null },
      select: { campaignContacts: { select: { openedAt: true, clickedAt: true } } },
    });
    const contacts = person?.campaignContacts ?? [];
    return {
      opens: contacts.filter((c) => c.openedAt).length,
      clicks: contacts.filter((c) => c.clickedAt).length,
    };
  }

  private async autoConvert(
    lead: { id: string; companyName: string | null; dataJson: Prisma.JsonValue },
    score: number,
    email?: string,
    phone?: string,
  ): Promise<void> {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { deletedAt: null },
      orderBy: { isDefault: 'desc' },
    });
    const stage = pipeline
      ? await this.prisma.stage.findFirst({
          where: { pipelineId: pipeline.id, deletedAt: null },
          orderBy: { order: 'asc' },
        })
      : null;
    const owner = await this.resolveOwner();

    if (!pipeline || !stage || !owner) {
      this.logger.warn(`auto-convert skipped for lead ${lead.id}: missing pipeline/stage/owner`);
      return;
    }

    const data = (lead.dataJson ?? {}) as Record<string, unknown>;
    const firstName =
      extractString(data, ['firstName', 'first_name', 'name', 'vorname']) ?? 'Unknown';
    const lastName = extractString(data, ['lastName', 'last_name', 'nachname']) ?? '';
    const title = lead.companyName ?? `${firstName} ${lastName}`.trim() ?? 'Auto-Lead';

    const deal = await this.prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          firstName,
          lastName,
          emails: email ? [email] : [],
          phones: phone ? [phone] : [],
          ownerId: owner.id,
        },
      });
      const createdDeal = await tx.deal.create({
        data: {
          title,
          stageId: stage.id,
          pipelineId: pipeline.id,
          ownerId: owner.id,
          score,
          participants: { connect: { id: person.id } },
        },
      });
      await tx.activity.create({
        data: {
          type: 'TASK',
          subject: `Auto-konvertiert durch KI-Scoring (Score: ${score})`,
          assigneeId: owner.id,
          dealId: createdDeal.id,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: { convertedDealId: createdDeal.id },
      });
      return createdDeal;
    });

    this.events.emitDealCreated({
      dealId: deal.id,
      pipelineId: pipeline.id,
      stageId: stage.id,
      userId: owner.id,
      ts: Date.now(),
    });
    this.logger.log(`auto-converted lead ${lead.id} → deal ${deal.id} (score ${score})`);
  }

  private resolveOwner(): Promise<{ id: string } | null> {
    const email = process.env.AI_DEFAULT_OWNER_EMAIL;
    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        ...(email ? { email } : { role: { in: [Role.ADMIN, Role.MANAGER] } }),
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
  }
}
