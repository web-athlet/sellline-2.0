import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EnrichmentStatus, Prisma } from '@nextgen/db';
import { Queue } from 'bullmq';
import DOMPurify from 'isomorphic-dompurify';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';

export const LEAD_ENRICHMENT_QUEUE = 'lead-enrichment';

const LEAD_SELECT = {
  id: true,
  source: true,
  formId: true,
  dataJson: true,
  enrichedJson: true,
  enrichmentStatus: true,
  convertedDealId: true,
  companyName: true,
  emailDomain: true,
  createdAt: true,
  updatedAt: true,
  form: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return '';
  return DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    out[key] = typeof val === 'string' ? sanitizeString(val) : val;
  }
  return out;
}

function extractString(data: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const key of candidates) {
    if (typeof data[key] === 'string' && (data[key] as string).length > 0) {
      return data[key] as string;
    }
  }
  return undefined;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    @InjectQueue(LEAD_ENRICHMENT_QUEUE) private readonly enrichmentQueue: Queue,
  ) {}

  async findAll(query: QueryLeadsDto) {
    const { page = 1, limit = 50, enrichmentStatus, formId } = query;

    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(enrichmentStatus ? { enrichmentStatus } : {}),
      ...(formId ? { formId } : {}),
    };

    const [total, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: LEAD_SELECT,
      }),
    ]);

    return {
      data: leads,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      select: LEAD_SELECT,
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async submitPublic(formId: string, rawData: Record<string, unknown>) {
    const form = await this.prisma.form.findFirst({
      where: { id: formId, deletedAt: null, isActive: true },
    });
    if (!form) throw new NotFoundException(`Form ${formId} not found`);

    const sanitized = sanitizeRecord(rawData);
    const companyName = extractString(sanitized, [
      'company',
      'companyName',
      'organization',
      'firma',
    ]);
    const email = extractString(sanitized, ['email', 'e-mail', 'Email']);
    const emailDomain = email ? email.split('@')[1] : undefined;

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          source: `form:${formId}`,
          formId,
          dataJson: sanitized as Prisma.InputJsonValue,
          companyName,
          emailDomain,
          enrichmentStatus: EnrichmentStatus.PENDING,
        },
        select: LEAD_SELECT,
      });

      await tx.form.update({
        where: { id: formId },
        data: { submissions: { increment: 1 } },
      });

      return created;
    });

    await this.enrichmentQueue.add(
      'enrich',
      { leadId: lead.id },
      { jobId: `enrich-${lead.id}`, removeOnComplete: true },
    );

    return lead;
  }

  async convert(id: string, dto: ConvertLeadDto) {
    const lead = await this.findOne(id);
    if (lead.convertedDealId) {
      throw new ConflictException(`Lead ${id} is already converted`);
    }

    const data = lead.dataJson as Record<string, unknown>;
    const firstName =
      extractString(data, ['firstName', 'first_name', 'name', 'vorname']) ?? 'Unknown';
    const lastName = extractString(data, ['lastName', 'last_name', 'nachname']) ?? '';
    const email = extractString(data, ['email', 'e-mail', 'Email']);
    const phone = extractString(data, ['phone', 'tel', 'telefon', 'mobile']);

    return this.prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          firstName,
          lastName,
          emails: email ? [email] : [],
          phones: phone ? [phone] : [],
          ownerId: dto.ownerId,
        },
      });

      const deal = await tx.deal.create({
        data: {
          title: dto.dealTitle,
          value: dto.dealValue ?? 0,
          stageId: dto.stageId,
          pipelineId: dto.pipelineId,
          ownerId: dto.ownerId,
          participants: { connect: { id: person.id } },
        },
      });

      await tx.lead.update({
        where: { id },
        data: { convertedDealId: deal.id },
      });

      return { person, deal };
    });
  }

  async reEnqueue(id: string) {
    const lead = await this.findOne(id);

    await this.prisma.lead.update({
      where: { id },
      data: { enrichmentStatus: EnrichmentStatus.PENDING },
    });

    await this.enrichmentQueue.add(
      'enrich',
      { leadId: lead.id },
      { jobId: `enrich-${lead.id}-${Date.now()}`, removeOnComplete: true },
    );

    return { queued: true };
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  emitLeadEnriched(leadId: string, status: 'DONE' | 'FAILED') {
    this.events.emitLeadEnriched({ leadId, status, ts: Date.now() });
  }
}
