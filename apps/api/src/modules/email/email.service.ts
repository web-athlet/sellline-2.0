import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@nextgen/db';
import OpenAI from 'openai';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSyncService } from './email-sync.service';
import type { QueryEmailsDto } from './dto/query-emails.dto';
import type { SendEmailDto } from './dto/send-email.dto';

const THREAD_SELECT = {
  id: true,
  threadId: true,
  fromAddress: true,
  toAddresses: true,
  cc: true,
  bcc: true,
  subject: true,
  bodyPreview: true,
  isRead: true,
  isSent: true,
  sentAt: true,
  dealId: true,
  userId: true,
  createdAt: true,
  deal: { select: { id: true, title: true } },
} satisfies Prisma.EmailSelect;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly sync: EmailSyncService,
  ) {
    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
  }

  // ─── Thread List (Inbox) ─────────────────────────────────────────────────

  async listThreads(userId: string, query: QueryEmailsDto) {
    const { page = 1, limit = 50, dealId, search } = query;

    // Get latest email per threadId (window-function emulated via subquery)
    const where: Prisma.EmailWhereInput = {
      userId,
      deletedAt: null,
      ...(dealId ? { dealId } : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: 'insensitive' } },
              { fromAddress: { contains: search, mode: 'insensitive' } },
              { bodyPreview: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Get all distinct threadIds (latest email per thread)
    const threads = await this.prisma.email.findMany({
      where,
      distinct: ['threadId'],
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: THREAD_SELECT,
    });

    const total = await this.prisma.email.count({
      where: { ...where, id: { in: threads.map((t) => t.id) } },
    });

    return {
      data: threads,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Thread Detail ───────────────────────────────────────────────────────

  async getThread(threadId: string, userId: string) {
    const emails = await this.prisma.email.findMany({
      where: { threadId, userId, deletedAt: null },
      orderBy: { sentAt: 'asc' },
      select: THREAD_SELECT,
    });

    if (emails.length === 0) throw new NotFoundException('Thread not found');

    // Mark all as read
    await this.prisma.email.updateMany({
      where: { threadId, userId, isRead: false },
      data: { isRead: true },
    });

    return { threadId, emails };
  }

  // ─── Unread Count (NavRail Badge) ────────────────────────────────────────

  async getUnreadCount(userId: string): Promise<{ unread: number }> {
    const unread = await this.prisma.email.count({
      where: { userId, isRead: false, deletedAt: null },
    });
    return { unread };
  }

  // ─── Send Email ──────────────────────────────────────────────────────────

  async sendEmail(userId: string, dto: SendEmailDto): Promise<{ emailId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gmailTokenEncrypted: true, outlookTokenEncrypted: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    let sentMessageId: string;

    if (user.gmailTokenEncrypted) {
      sentMessageId = await this.sync.sendGmailMessage(userId, dto);
    } else if (user.outlookTokenEncrypted) {
      sentMessageId = await this.sendOutlookMessage(userId, dto);
    } else {
      throw new ServiceUnavailableException('No email provider connected');
    }

    const firstTo = dto.to[0] ?? '';
    const dealId =
      dto.dealId ?? (firstTo ? await this.sync.matchDealByAddress(firstTo, userId) : null);

    const email = await this.prisma.email.create({
      data: {
        gmailMessageId: user.gmailTokenEncrypted ? sentMessageId : null,
        outlookMessageId: user.outlookTokenEncrypted ? sentMessageId : null,
        threadId: dto.threadId ?? sentMessageId,
        fromAddress: user.email,
        toAddresses: dto.to,
        cc: dto.cc ?? [],
        bcc: dto.bcc ?? [],
        subject: dto.subject,
        bodyEncrypted: this.encryption.encrypt(dto.bodyHtml),
        bodyPreview: dto.bodyHtml.replace(/<[^>]+>/g, '').slice(0, 200),
        sentAt: new Date(),
        isSent: true,
        isRead: true,
        userId,
        dealId: dealId ?? null,
      },
    });

    return { emailId: email.id };
  }

  private async sendOutlookMessage(userId: string, dto: SendEmailDto): Promise<string> {
    const bearer = await this.sync.getOutlookAccessToken(userId);
    const body: Record<string, unknown> = {
      subject: dto.subject,
      body: { contentType: 'HTML', content: dto.bodyHtml },
      toRecipients: dto.to.map((a) => ({ emailAddress: { address: a } })),
      ccRecipients: (dto.cc ?? []).map((a) => ({ emailAddress: { address: a } })),
      bccRecipients: (dto.bcc ?? []).map((a) => ({ emailAddress: { address: a } })),
    };

    const resp = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: body, saveToSentItems: true }),
    });

    if (!resp.ok) throw new Error(`Outlook send failed: ${resp.status}`);
    return `outlook-${Date.now()}`;
  }

  // ─── AI Thread Summary ───────────────────────────────────────────────────

  async summarizeThread(threadId: string, userId: string) {
    if (!this.openai) throw new ServiceUnavailableException('OpenAI not configured');

    const emails = await this.prisma.email.findMany({
      where: { threadId, userId, deletedAt: null },
      orderBy: { sentAt: 'asc' },
      select: { fromAddress: true, sentAt: true, bodyEncrypted: true, subject: true },
    });

    if (emails.length === 0) throw new NotFoundException('Thread not found');
    if (emails.length < 5) {
      return { bullets: [], suggestedReply: null, tone: 'neutral', skipped: true };
    }

    const decrypted = emails.map((e) => ({
      from: e.fromAddress,
      date: e.sentAt.toISOString(),
      body: this.encryption
        .decrypt(e.bodyEncrypted)
        .replace(/<[^>]+>/g, '')
        .slice(0, 500),
    }));

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Du fasst E-Mail-Threads für Sales-Reps zusammen. Antworte ausschließlich mit JSON.',
        },
        {
          role: 'user',
          content: `Thread mit ${decrypted.length} E-Mails. Gib zurück:
{ "bullets": ["Punkt 1", "Punkt 2", "Punkt 3"], "suggestedReply": "Draft-Text für Sales-Rep...", "tone": "friendly|neutral|urgent" }

E-Mails:
${JSON.stringify(decrypted)}`,
        },
      ],
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    return JSON.parse(raw) as {
      bullets: string[];
      suggestedReply: string;
      tone: 'friendly' | 'neutral' | 'urgent';
    };
  }

  // ─── Provider Status ─────────────────────────────────────────────────────

  async getProviders(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        gmailTokenEncrypted: true,
        gmailWatchExpiresAt: true,
        outlookTokenEncrypted: true,
        outlookSubscriptionExpiresAt: true,
      },
    });

    return {
      gmail: {
        connected: !!user?.gmailTokenEncrypted,
        watchExpiresAt: user?.gmailWatchExpiresAt ?? null,
      },
      outlook: {
        connected: !!user?.outlookTokenEncrypted,
        subscriptionExpiresAt: user?.outlookSubscriptionExpiresAt ?? null,
      },
    };
  }
}
