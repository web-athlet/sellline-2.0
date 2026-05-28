import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { CampaignStatus, Prisma } from '@nextgen/db';
import { Queue } from 'bullmq';
import DOMPurify from 'isomorphic-dompurify';
import OpenAI from 'openai';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCampaignDto } from './dto/create-campaign.dto';
import type { UpdateCampaignDto } from './dto/update-campaign.dto';
import type { QueryCampaignsDto } from './dto/query-campaigns.dto';
import type { AddContactsDto } from './dto/add-contacts.dto';

export const CAMPAIGN_SEND_QUEUE = 'campaign-send';
const BATCH_SIZE = 50;

export interface SendBatchJob {
  campaignId: string;
  contactIds: string[];
  batchIndex: number;
  totalBatches: number;
}

export interface AiSubjectSuggestion {
  subject: string;
  reasoning: string;
  estimatedOpenRate: number;
}

const CAMPAIGN_SELECT = {
  id: true,
  name: true,
  subject: true,
  bodyHtml: true,
  previewText: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  senderId: true,
  totalRecipients: true,
  openCount: true,
  clickCount: true,
  unsubCount: true,
  bounceCount: true,
  createdAt: true,
  updatedAt: true,
  sender: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CampaignSelect;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private readonly trackingSecret: string;
  private readonly openai: OpenAI | null;
  private readonly apiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(CAMPAIGN_SEND_QUEUE) private readonly sendQueue: Queue,
  ) {
    this.trackingSecret =
      process.env.CAMPAIGN_TRACKING_SECRET ?? process.env.JWT_SECRET ?? 'dev-tracking-secret';
    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  }

  // ─── HMAC Token Helpers ───────────────────────────────────────────────────

  generateTrackingToken(
    campaignId: string,
    personId: string,
    action: 'open' | 'click' | 'unsub',
  ): string {
    const payload = `${campaignId}:${personId}:${action}`;
    const sig = createHmac('sha256', this.trackingSecret)
      .update(payload)
      .digest('hex')
      .slice(0, 16);
    return `${payload}:${sig}`;
  }

  validateTrackingToken(
    token: string,
  ): { campaignId: string; personId: string; action: string } | null {
    const parts = token.split(':');
    if (parts.length !== 4) return null;
    const [campaignId, personId, action, sig] = parts;
    if (!campaignId || !personId || !action || !sig) return null;

    const expectedSig = createHmac('sha256', this.trackingSecret)
      .update(`${campaignId}:${personId}:${action}`)
      .digest('hex')
      .slice(0, 16);

    try {
      if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    } catch {
      return null;
    }
    return { campaignId, personId, action };
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(dto: CreateCampaignDto, senderId: string) {
    const clean = DOMPurify.sanitize(dto.bodyHtml, { USE_PROFILES: { html: true } });
    return this.prisma.campaign.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        bodyHtml: clean,
        previewText: dto.previewText,
        senderId,
        status: CampaignStatus.DRAFT,
      },
      select: CAMPAIGN_SELECT,
    });
  }

  async findAll(query: QueryCampaignsDto) {
    const { page = 1, limit = 50, status } = query;
    const where: Prisma.CampaignWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: CAMPAIGN_SELECT,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...CAMPAIGN_SELECT,
        contacts: {
          select: {
            id: true,
            personId: true,
            trackingToken: true,
            sentAt: true,
            openedAt: true,
            clickedAt: true,
            unsubscribedAt: true,
            bouncedAt: true,
            person: {
              select: { id: true, firstName: true, lastName: true, emails: true, optIn: true },
            },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      select: { status: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT campaigns can be edited');
    }
    const data: Prisma.CampaignUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.subject !== undefined) data.subject = dto.subject;
    if (dto.bodyHtml !== undefined)
      data.bodyHtml = DOMPurify.sanitize(dto.bodyHtml, { USE_PROFILES: { html: true } });
    if (dto.previewText !== undefined) data.previewText = dto.previewText;

    return this.prisma.campaign.update({ where: { id }, data, select: CAMPAIGN_SELECT });
  }

  async remove(id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Cannot delete a campaign that is currently sending');
    }
    await this.prisma.campaign.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Recipients ───────────────────────────────────────────────────────────

  async addContacts(id: string, dto: AddContactsDto) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Contacts can only be added to DRAFT campaigns');
    }

    const persons = await this.prisma.person.findMany({
      where: { id: { in: dto.personIds }, deletedAt: null },
      select: { id: true },
    });

    const data = persons.map((p) => ({
      campaignId: id,
      personId: p.id,
      trackingToken: this.generateTrackingToken(id, p.id, 'open'),
    }));

    await this.prisma.campaignContact.createMany({
      data,
      skipDuplicates: true,
    });

    const count = await this.prisma.campaignContact.count({ where: { campaignId: id } });
    await this.prisma.campaign.update({
      where: { id },
      data: { totalRecipients: count },
    });

    return { added: data.length, total: count };
  }

  async removeContact(campaignId: string, personId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, deletedAt: null },
      select: { status: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Contacts can only be removed from DRAFT campaigns');
    }

    const contact = await this.prisma.campaignContact.findFirst({
      where: { campaignId, personId },
    });
    if (!contact) throw new NotFoundException('Contact not in campaign');

    await this.prisma.campaignContact.delete({ where: { id: contact.id } });
    const count = await this.prisma.campaignContact.count({ where: { campaignId } });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: count },
    });
  }

  // ─── DSGVO Validation ─────────────────────────────────────────────────────

  async validateRecipients(campaignId: string): Promise<void> {
    const recipients = await this.prisma.campaignContact.findMany({
      where: { campaignId },
      include: { person: { select: { optIn: true, deletedAt: true } } },
    });

    if (recipients.length === 0) {
      throw new BadRequestException({
        message: 'Campaign has no recipients',
        code: 'NO_RECIPIENTS',
      });
    }

    const nonOptIn = recipients.filter((r) => !r.person.optIn || r.person.deletedAt !== null);
    if (nonOptIn.length > 0) {
      throw new BadRequestException({
        message: `${nonOptIn.length} Empfänger ohne DSGVO-Opt-in`,
        code: 'DSGVO_VIOLATION',
        details: nonOptIn.map((r) => ({ personId: r.personId })),
      });
    }
  }

  // ─── Send ────────────────────────────────────────────────────────────────

  async sendCampaign(id: string, senderId: string): Promise<void> {
    await this.validateRecipients(id);

    const contacts = await this.prisma.campaignContact.findMany({
      where: { campaignId: id },
      select: { id: true },
    });

    await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.SENDING, sentAt: new Date(), senderId },
    });

    const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);
    for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
      const batch = contacts.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE);
      await this.sendQueue.add(
        'send-batch',
        {
          campaignId: id,
          contactIds: batch.map((c) => c.id),
          batchIndex,
          totalBatches,
        } satisfies SendBatchJob,
        {
          delay: batchIndex * 1000,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      );
    }
  }

  async testSend(id: string, userId: string): Promise<{ to: string; preview: string }> {
    const [campaign, user] = await Promise.all([
      this.prisma.campaign.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, subject: true, bodyHtml: true, name: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    ]);

    if (!campaign) throw new NotFoundException('Campaign not found');
    if (!user) throw new NotFoundException('User not found');

    // Log test send (SMTP wired in production)
    this.logger.log(
      `[CAMPAIGN_TEST_SEND] to=${user.email.split('@')[0]}***@${user.email.split('@')[1]} campaign="${campaign.name}"`,
    );

    return { to: user.email, preview: campaign.bodyHtml.slice(0, 200) };
  }

  // ─── AI Subject Suggestions ───────────────────────────────────────────────

  async generateAiSubjects(id: string): Promise<AiSubjectSuggestion[]> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      select: { subject: true, bodyHtml: true },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    if (!this.openai) {
      throw new ServiceUnavailableException('OpenAI not configured (OPENAI_API_KEY missing)');
    }

    const bodyPreview = campaign.bodyHtml.replace(/<[^>]+>/g, '').slice(0, 500);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Du bist E-Mail-Marketing-Experte. Antworte nur JSON.' },
        {
          role: 'user',
          content: `Generiere 3 Betreffzeilen (max 60 Zeichen) für max. Öffnungsrate.
Ursprung: "${campaign.subject}"
Body-Preview: "${bodyPreview}"

JSON: { "suggestions": [{ "subject": "...", "reasoning": "warum", "estimatedOpenRate": 25 }] }`,
        },
      ],
    });

    const raw = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
      suggestions?: AiSubjectSuggestion[];
    };
    return (raw.suggestions ?? []).slice(0, 3);
  }

  // ─── Tracking ─────────────────────────────────────────────────────────────

  async trackOpen(token: string): Promise<void> {
    const parsed = this.validateTrackingToken(token);
    if (!parsed || parsed.action !== 'open') return;

    const contact = await this.prisma.campaignContact.findFirst({
      where: { campaignId: parsed.campaignId, personId: parsed.personId },
    });
    if (!contact || contact.openedAt) return;

    await Promise.all([
      this.prisma.campaignContact.update({
        where: { id: contact.id },
        data: { openedAt: new Date() },
      }),
      this.prisma.campaign.update({
        where: { id: parsed.campaignId },
        data: { openCount: { increment: 1 } },
      }),
    ]);
  }

  async trackClick(token: string, url: string): Promise<string> {
    const parsed = this.validateTrackingToken(token);
    if (!parsed || parsed.action !== 'click') return url;

    const contact = await this.prisma.campaignContact.findFirst({
      where: { campaignId: parsed.campaignId, personId: parsed.personId },
    });
    if (!contact) return url;

    if (!contact.clickedAt) {
      await Promise.all([
        this.prisma.campaignContact.update({
          where: { id: contact.id },
          data: { clickedAt: new Date() },
        }),
        this.prisma.campaign.update({
          where: { id: parsed.campaignId },
          data: { clickCount: { increment: 1 } },
        }),
      ]);
    }
    return url;
  }

  async unsubscribe(token: string): Promise<{ firstName: string; campaignName: string }> {
    const parsed = this.validateTrackingToken(token);
    if (!parsed || parsed.action !== 'unsub') {
      throw new BadRequestException('Invalid unsubscribe token');
    }

    const contact = await this.prisma.campaignContact.findFirst({
      where: { campaignId: parsed.campaignId, personId: parsed.personId },
      include: {
        person: { select: { id: true, firstName: true, optIn: true } },
        campaign: { select: { name: true } },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    if (!contact.unsubscribedAt) {
      await Promise.all([
        this.prisma.person.update({
          where: { id: contact.person.id },
          data: { optIn: false, optOutAt: new Date() },
        }),
        this.prisma.campaignContact.update({
          where: { id: contact.id },
          data: { unsubscribedAt: new Date() },
        }),
        this.prisma.campaign.update({
          where: { id: parsed.campaignId },
          data: { unsubCount: { increment: 1 } },
        }),
      ]);
    }

    return { firstName: contact.person.firstName, campaignName: contact.campaign.name };
  }

  // ─── Bounce Handling (SendGrid) ────────────────────────────────────────────

  async handleSendGridBounce(events: SendGridBounceEvent[]): Promise<void> {
    for (const event of events) {
      if (!event.email || !event.event) continue;

      const person = await this.prisma.person.findFirst({
        where: { emails: { hasSome: [event.email] }, deletedAt: null },
        select: { id: true },
      });
      if (!person) continue;

      const contact = await this.prisma.campaignContact.findFirst({
        where: { personId: person.id, bouncedAt: null },
        orderBy: { campaign: { sentAt: 'desc' } },
        select: { id: true, campaignId: true },
      });

      if (event.event === 'bounce') {
        // Hard bounce: mark contact + opt-out person
        await Promise.all([
          ...(contact
            ? [
                this.prisma.campaignContact.update({
                  where: { id: contact.id },
                  data: { bouncedAt: new Date() },
                }),
                this.prisma.campaign.update({
                  where: { id: contact.campaignId },
                  data: { bounceCount: { increment: 1 } },
                }),
              ]
            : []),
          this.prisma.person.update({
            where: { id: person.id },
            data: { optIn: false, optOutAt: new Date() },
          }),
        ]);
      } else if (event.event === 'deferred' || event.event === 'dropped') {
        // Soft bounce: just increment counter
        if (contact) {
          await Promise.all([
            this.prisma.campaignContact.update({
              where: { id: contact.id },
              data: { bouncedAt: new Date() },
            }),
            this.prisma.campaign.update({
              where: { id: contact.campaignId },
              data: { bounceCount: { increment: 1 } },
            }),
          ]);
        }
      }
    }
  }

  // ─── Inject Tracking Into HTML ────────────────────────────────────────────

  injectTracking(
    bodyHtml: string,
    campaignId: string,
    personId: string,
    firstName: string,
    orgName: string,
  ): string {
    const openSig = this.generateTrackingToken(campaignId, personId, 'open');
    const clickSig = this.generateTrackingToken(campaignId, personId, 'click');
    const unsubSig = this.generateTrackingToken(campaignId, personId, 'unsub');

    let html = bodyHtml
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{orgName\}\}/g, orgName);

    // Wrap links with click tracking
    html = html.replace(/<a\s+([^>]*?)href="([^"]+)"([^>]*?)>/gi, (_, pre, url, post) => {
      const tracked = `${this.apiUrl}/api/v1/public/track/click/${clickSig}?url=${encodeURIComponent(url)}`;
      return `<a ${pre}href="${tracked}"${post}>`;
    });

    // Add unsubscribe footer
    html += `
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">
  <a href="${this.apiUrl}/api/v1/public/unsubscribe/${unsubSig}" style="color:#999;">Abmelden / Unsubscribe</a>
</div>`;

    // Add open-tracking pixel at the bottom
    html += `<img src="${this.apiUrl}/api/v1/public/track/open/${openSig}" width="1" height="1" alt="" style="display:none;" />`;

    return html;
  }

  // ─── Internal: finalize campaign after all batches ────────────────────────

  async finalizeCampaignIfComplete(campaignId: string): Promise<void> {
    const [total, sent] = await Promise.all([
      this.prisma.campaignContact.count({ where: { campaignId } }),
      this.prisma.campaignContact.count({ where: { campaignId, sentAt: { not: null } } }),
    ]);
    if (total > 0 && sent >= total) {
      await this.prisma.campaign.update({
        where: { id: campaignId, status: CampaignStatus.SENDING },
        data: { status: CampaignStatus.SENT },
      });
    }
  }
}

export interface SendGridBounceEvent {
  email?: string;
  event?: 'bounce' | 'deferred' | 'dropped' | 'delivered' | string;
  timestamp?: number;
  sg_message_id?: string;
}
