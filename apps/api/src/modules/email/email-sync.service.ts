import { createHmac } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { gmail_v1 } from 'googleapis';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';

export const EMAIL_SYNC_QUEUE = 'email-sync';
export const EMAIL_POLL_QUEUE = 'email-poll';

// Gmail OAuth scopes for full email sync
const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

// Outlook / Microsoft Graph scopes
const OUTLOOK_SCOPES = [
  'offline_access',
  'https://graph.microsoft.com/Mail.ReadWrite',
  'https://graph.microsoft.com/Mail.Send',
];

const GRAPH_API = 'https://graph.microsoft.com/v1.0';

function buildStateToken(userId: string, secret: string): string {
  const ts = Date.now();
  const mac = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex');
  return Buffer.from(`${userId}:${ts}:${mac}`).toString('base64url');
}

function verifyStateToken(state: string, secret: string): { valid: boolean; userId: string } {
  try {
    const decoded = Buffer.from(state, 'base64url').toString();
    const [userId, tsStr, mac] = decoded.split(':');
    if (!userId || !tsStr || !mac) return { valid: false, userId: '' };
    const ts = parseInt(tsStr, 10);
    if (Date.now() - ts > 10 * 60 * 1000) return { valid: false, userId: '' }; // 10 min TTL
    const expected = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex');
    if (expected !== mac) return { valid: false, userId: '' };
    return { valid: true, userId };
  } catch {
    return { valid: false, userId: '' };
  }
}

@Injectable()
export class EmailSyncService implements OnModuleInit {
  private readonly logger = new Logger(EmailSyncService.name);
  private readonly stateSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly events: EventsGateway,
    @InjectQueue(EMAIL_SYNC_QUEUE) private readonly syncQueue: Queue,
    @InjectQueue(EMAIL_POLL_QUEUE) private readonly pollQueue: Queue,
  ) {
    this.stateSecret =
      process.env.EMAIL_OAUTH_STATE_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';
  }

  async onModuleInit(): Promise<void> {
    // Register the repeatable poll job (every 5 min, for users without active watch)
    await this.pollQueue
      .add(
        'poll-all',
        {},
        {
          repeat: { pattern: '*/5 * * * *' },
          removeOnComplete: { count: 10 },
          removeOnFail: { count: 5 },
          jobId: 'email-poll-repeatable',
        },
      )
      .catch((err) => this.logger.warn(`Poll job registration failed: ${err}`));

    // Register daily watch-renewal job (03:00 UTC)
    await this.syncQueue
      .add(
        'renew-watches',
        {},
        {
          repeat: { pattern: '0 3 * * *' },
          removeOnComplete: { count: 5 },
          jobId: 'email-watch-renewal',
        },
      )
      .catch((err) => this.logger.warn(`Watch renewal job registration failed: ${err}`));
  }

  // ─── Gmail OAuth ───────────────────────────────────────────────────────────

  private getOAuth2Client(): OAuth2Client {
    return new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GMAIL_SYNC_CALLBACK_URL ?? 'http://localhost:3001/api/v1/email/gmail/callback',
    );
  }

  buildGmailConnectUrl(userId: string): string {
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
      throw new ServiceUnavailableException('Gmail not configured');
    }
    const client = this.getOAuth2Client();
    const state = buildStateToken(userId, this.stateSecret);
    return client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GMAIL_SCOPES,
      state,
    });
  }

  async handleGmailCallback(code: string, state: string): Promise<string> {
    const { valid, userId } = verifyStateToken(state, this.stateSecret);
    if (!valid || !userId) throw new UnauthorizedException('Invalid OAuth state');

    const client = this.getOAuth2Client();
    const { tokens } = await client.getToken(code);
    await this.prisma.user.update({
      where: { id: userId },
      data: { gmailTokenEncrypted: this.encryption.encrypt(JSON.stringify(tokens)) },
    });

    // Immediately set up Gmail Watch if GCP PubSub is configured
    if (process.env.GCP_PUBSUB_PROJECT) {
      await this.setupGmailWatch(userId).catch((err) =>
        this.logger.warn(`Gmail watch setup failed for ${userId}: ${err}`),
      );
    }

    return userId;
  }

  async disconnectGmail(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gmailTokenEncrypted: null,
        gmailHistoryId: null,
        gmailWatchExpiresAt: null,
      },
    });
  }

  // ─── Gmail Token Refresh ───────────────────────────────────────────────────

  async getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.gmailTokenEncrypted) throw new ServiceUnavailableException('Gmail not connected');

    const tokens = JSON.parse(this.encryption.decrypt(user.gmailTokenEncrypted)) as {
      access_token?: string;
      refresh_token?: string;
      expiry_date?: number;
    };

    const client = this.getOAuth2Client();
    client.setCredentials(tokens);

    // Proactively refresh if token expires within 60 s
    if (tokens.expiry_date && tokens.expiry_date < Date.now() + 60_000) {
      const { credentials } = await client.refreshAccessToken();
      await this.prisma.user.update({
        where: { id: userId },
        data: { gmailTokenEncrypted: this.encryption.encrypt(JSON.stringify(credentials)) },
      });
      client.setCredentials(credentials);
    }

    return google.gmail({ version: 'v1', auth: client });
  }

  // ─── Gmail Watch ──────────────────────────────────────────────────────────

  async setupGmailWatch(userId: string): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    const project = process.env.GCP_PUBSUB_PROJECT;
    const topic = process.env.GCP_PUBSUB_TOPIC ?? 'nextgen-gmail-push';
    if (!project) {
      this.logger.debug('GCP_PUBSUB_PROJECT not set — skipping Gmail watch');
      return;
    }

    const resp = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        labelIds: ['INBOX'],
        topicName: `projects/${project}/topics/${topic}`,
      },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gmailHistoryId: resp.data.historyId ?? null,
        gmailWatchExpiresAt: resp.data.expiration ? new Date(Number(resp.data.expiration)) : null,
      },
    });
    this.logger.log(`Gmail watch set up for user ${userId}, historyId=${resp.data.historyId}`);
  }

  async renewExpiredWatches(): Promise<void> {
    const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: {
        gmailTokenEncrypted: { not: null },
        deletedAt: null,
        OR: [{ gmailWatchExpiresAt: null }, { gmailWatchExpiresAt: { lte: oneDayFromNow } }],
      },
      select: { id: true },
    });

    this.logger.log(`Renewing Gmail watch for ${users.length} users`);
    for (const u of users) {
      await this.setupGmailWatch(u.id).catch((err) =>
        this.logger.warn(`Watch renewal failed for ${u.id}: ${err}`),
      );
    }
  }

  // ─── Gmail Incremental Sync ───────────────────────────────────────────────

  async verifyPubSubToken(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    if (!process.env.GCP_PUBSUB_SA_EMAIL) return true; // dev: skip verification

    try {
      const { OAuth2Client: GOAuth2 } = await import('google-auth-library');
      const authClient = new GOAuth2();
      const ticket = await authClient.verifyIdToken({ idToken: token });
      const payload = ticket.getPayload();
      return payload?.email === process.env.GCP_PUBSUB_SA_EMAIL;
    } catch {
      return false;
    }
  }

  async enqueueGmailSync(emailAddress: string, historyId: string): Promise<void> {
    await this.syncQueue.add('gmail-history', { type: 'gmail', emailAddress, historyId });
  }

  async syncFromGmailHistory(emailAddress: string, newHistoryId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: emailAddress, deletedAt: null },
      select: { id: true, gmailHistoryId: true },
    });
    if (!user?.gmailHistoryId) return;

    const gmail = await this.getGmailClient(user.id);

    let pageToken: string | undefined;
    const messageIds: string[] = [];

    do {
      const history = await gmail.users.history.list({
        userId: 'me',
        startHistoryId: user.gmailHistoryId,
        historyTypes: ['messageAdded'],
        pageToken,
      });

      for (const h of history.data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          if (added.message?.id) messageIds.push(added.message.id);
        }
      }
      pageToken = history.data.nextPageToken ?? undefined;
    } while (pageToken);

    for (const id of messageIds) {
      await this.fetchAndStoreGmailMessage(user.id, id).catch((err) =>
        this.logger.warn(`Failed to store message ${id}: ${err}`),
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { gmailHistoryId: newHistoryId },
    });
  }

  async fetchAndStoreGmailMessage(userId: string, messageId: string): Promise<void> {
    // Skip if already stored
    const existing = await this.prisma.email.findUnique({
      where: { gmailMessageId: messageId },
    });
    if (existing) return;

    const gmail = await this.getGmailClient(userId);
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const parsed = this.parseGmailMessage(msg.data);
    const dealId = await this.matchDealByAddress(parsed.from, userId);

    const email = await this.prisma.email.create({
      data: {
        gmailMessageId: messageId,
        threadId: parsed.threadId,
        fromAddress: parsed.from,
        toAddresses: parsed.to,
        cc: parsed.cc,
        bcc: parsed.bcc,
        subject: parsed.subject,
        bodyEncrypted: this.encryption.encrypt(parsed.bodyHtml || parsed.bodyText),
        bodyPreview: parsed.bodyText.slice(0, 200),
        sentAt: new Date(parsed.date),
        isSent: parsed.isSent,
        userId,
        dealId,
      },
    });

    this.events.emitEmailReceived({
      userId,
      emailId: email.id,
      threadId: email.threadId,
      ts: Date.now(),
    });

    const unread = await this.prisma.email.count({
      where: { userId, isRead: false, deletedAt: null },
    });
    this.events.emitEmailCountUpdated({ userId, unreadCount: unread, ts: Date.now() });
  }

  // ─── Gmail Poll Fallback ──────────────────────────────────────────────────

  async pollAllUsers(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: { gmailTokenEncrypted: { not: null }, deletedAt: null },
      select: { id: true, email: true },
    });

    for (const user of users) {
      await this.pollGmailForUser(user.id, tenMinutesAgo).catch((err) =>
        this.logger.warn(`Poll failed for user ${user.id}: ${err}`),
      );
    }
  }

  private async pollGmailForUser(userId: string, since: Date): Promise<void> {
    const gmail = await this.getGmailClient(userId);
    const sinceSeconds = Math.floor(since.getTime() / 1000);
    const list = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${sinceSeconds}`,
      maxResults: 20,
    });

    for (const m of list.data.messages ?? []) {
      if (m.id) {
        await this.fetchAndStoreGmailMessage(userId, m.id).catch(() => {
          /* ignore dup */
        });
      }
    }
  }

  // ─── Gmail Send ──────────────────────────────────────────────────────────

  async sendGmailMessage(
    userId: string,
    opts: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      bodyHtml: string;
      threadId?: string;
      inReplyToMessageId?: string;
    },
  ): Promise<string> {
    const gmail = await this.getGmailClient(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new Error('User not found');

    const toHeader = opts.to.join(', ');
    const ccHeader = opts.cc?.length ? `Cc: ${opts.cc.join(', ')}\r\n` : '';
    const bccHeader = opts.bcc?.length ? `Bcc: ${opts.bcc.join(', ')}\r\n` : '';
    const inReplyTo = opts.inReplyToMessageId
      ? `In-Reply-To: ${opts.inReplyToMessageId}\r\nReferences: ${opts.inReplyToMessageId}\r\n`
      : '';

    const raw = [
      `From: ${user.email}`,
      `To: ${toHeader}`,
      ccHeader.trim(),
      bccHeader.trim(),
      `Subject: =?UTF-8?B?${Buffer.from(opts.subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      inReplyTo.trim(),
      '',
      opts.bodyHtml,
    ]
      .filter((l) => l !== '')
      .join('\r\n');

    const encoded = Buffer.from(raw).toString('base64url');

    const resp = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded, threadId: opts.threadId },
    });

    return resp.data.id ?? '';
  }

  // ─── Outlook OAuth ────────────────────────────────────────────────────────

  buildOutlookConnectUrl(userId: string): string {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    if (!clientId) throw new ServiceUnavailableException('Outlook not configured');

    const state = buildStateToken(userId, this.stateSecret);
    const callback =
      process.env.OUTLOOK_SYNC_CALLBACK_URL ??
      'http://localhost:3001/api/v1/email/outlook/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: callback,
      scope: OUTLOOK_SCOPES.join(' '),
      response_mode: 'query',
      state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  }

  async handleOutlookCallback(code: string, state: string): Promise<string> {
    const { valid, userId } = verifyStateToken(state, this.stateSecret);
    if (!valid || !userId) throw new UnauthorizedException('Invalid OAuth state');

    const callback =
      process.env.OUTLOOK_SYNC_CALLBACK_URL ??
      'http://localhost:3001/api/v1/email/outlook/callback';

    const body = new URLSearchParams({
      client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
      code,
      redirect_uri: callback,
      grant_type: 'authorization_code',
    });

    const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) throw new Error(`Outlook token exchange failed: ${resp.status}`);
    const tokens = (await resp.json()) as Record<string, unknown>;

    await this.prisma.user.update({
      where: { id: userId },
      data: { outlookTokenEncrypted: this.encryption.encrypt(JSON.stringify(tokens)) },
    });

    await this.setupOutlookSubscription(userId).catch((err) =>
      this.logger.warn(`Outlook subscription setup failed: ${err}`),
    );

    return userId;
  }

  async disconnectOutlook(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { outlookSubscriptionId: true },
    });
    if (user?.outlookSubscriptionId) {
      await this.deleteOutlookSubscription(userId, user.outlookSubscriptionId).catch(() => {});
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        outlookTokenEncrypted: null,
        outlookSubscriptionId: null,
        outlookSubscriptionExpiresAt: null,
      },
    });
  }

  // ─── Outlook Token Refresh ────────────────────────────────────────────────

  async getOutlookAccessToken(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.outlookTokenEncrypted)
      throw new ServiceUnavailableException('Outlook not connected');

    const creds = JSON.parse(this.encryption.decrypt(user.outlookTokenEncrypted)) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      obtained_at?: number;
    };

    const obtainedAt = creds.obtained_at ?? Date.now();
    const expiresIn = (creds.expires_in ?? 3600) * 1000;
    const expiresAt = obtainedAt + expiresIn;

    if (expiresAt < Date.now() + 60_000 && creds.refresh_token) {
      const body = new URLSearchParams({
        client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? '',
        client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? '',
        refresh_token: creds.refresh_token,
        grant_type: 'refresh_token',
        scope: OUTLOOK_SCOPES.join(' '),
      });

      const resp = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (resp.ok) {
        const refreshed = (await resp.json()) as Record<string, unknown>;
        const newTokens = { ...refreshed, obtained_at: Date.now() };
        await this.prisma.user.update({
          where: { id: userId },
          data: { outlookTokenEncrypted: this.encryption.encrypt(JSON.stringify(newTokens)) },
        });
        return (refreshed as { access_token: string }).access_token;
      }
    }

    return creds.access_token ?? '';
  }

  // ─── Outlook Subscription ────────────────────────────────────────────────

  async setupOutlookSubscription(userId: string): Promise<void> {
    const bearer = await this.getOutlookAccessToken(userId);
    const notifUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/webhooks/outlook`;

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    const resp = await fetch(`${GRAPH_API}/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl: notifUrl,
        resource: '/me/mailFolders/inbox/messages',
        expirationDateTime: expiresAt.toISOString(),
        clientState: buildStateToken(userId, this.stateSecret),
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      this.logger.warn(`Outlook subscription create failed: ${err}`);
      return;
    }

    const sub = (await resp.json()) as { id: string };
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        outlookSubscriptionId: sub.id,
        outlookSubscriptionExpiresAt: expiresAt,
      },
    });
  }

  private async deleteOutlookSubscription(userId: string, subId: string): Promise<void> {
    const bearer = await this.getOutlookAccessToken(userId);
    await fetch(`${GRAPH_API}/subscriptions/${subId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${bearer}` },
    });
  }

  async renewExpiredOutlookSubscriptions(): Promise<void> {
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const users = await this.prisma.user.findMany({
      where: {
        outlookTokenEncrypted: { not: null },
        deletedAt: null,
        OR: [
          { outlookSubscriptionExpiresAt: null },
          { outlookSubscriptionExpiresAt: { lte: twoDaysFromNow } },
        ],
      },
      select: { id: true },
    });

    for (const u of users) {
      await this.setupOutlookSubscription(u.id).catch((err) =>
        this.logger.warn(`Outlook subscription renewal failed for ${u.id}: ${err}`),
      );
    }
  }

  // ─── Outlook Message Sync ─────────────────────────────────────────────────

  async fetchAndStoreOutlookMessage(userId: string, messageId: string): Promise<void> {
    const existing = await this.prisma.email.findUnique({
      where: { outlookMessageId: messageId },
    });
    if (existing) return;

    const bearer = await this.getOutlookAccessToken(userId);
    const resp = await fetch(
      `${GRAPH_API}/me/messages/${messageId}?$select=id,subject,body,from,toRecipients,ccRecipients,bccRecipients,sentDateTime,isDraft,isRead,conversationId,parentFolderId`,
      { headers: { Authorization: `Bearer ${bearer}` } },
    );

    if (!resp.ok) return;
    const msg = (await resp.json()) as {
      id: string;
      subject: string;
      body: { content: string; contentType: string };
      from: { emailAddress: { address: string } };
      toRecipients: Array<{ emailAddress: { address: string } }>;
      ccRecipients: Array<{ emailAddress: { address: string } }>;
      bccRecipients: Array<{ emailAddress: { address: string } }>;
      sentDateTime: string;
      isDraft: boolean;
      isRead: boolean;
      conversationId: string;
      parentFolderId: string;
    };

    if (msg.isDraft) return;

    const bodyHtml =
      msg.body.contentType === 'html' ? msg.body.content : `<p>${msg.body.content}</p>`;
    const bodyText = msg.body.content.replace(/<[^>]+>/g, '').slice(0, 200);
    const dealId = await this.matchDealByAddress(msg.from.emailAddress.address, userId);

    const email = await this.prisma.email.create({
      data: {
        outlookMessageId: msg.id,
        threadId: msg.conversationId,
        fromAddress: msg.from.emailAddress.address,
        toAddresses: msg.toRecipients.map((r) => r.emailAddress.address),
        cc: msg.ccRecipients.map((r) => r.emailAddress.address),
        bcc: msg.bccRecipients.map((r) => r.emailAddress.address),
        subject: msg.subject,
        bodyEncrypted: this.encryption.encrypt(bodyHtml),
        bodyPreview: bodyText,
        sentAt: new Date(msg.sentDateTime),
        isRead: msg.isRead,
        userId,
        dealId,
      },
    });

    this.events.emitEmailReceived({
      userId,
      emailId: email.id,
      threadId: email.threadId,
      ts: Date.now(),
    });
  }

  // ─── Deal Matching ────────────────────────────────────────────────────────

  async matchDealByAddress(fromAddress: string, userId: string): Promise<string | null> {
    const domain = fromAddress.split('@')[1];
    if (!domain) return null;

    const org = await this.prisma.organization.findFirst({
      where: { domain, deletedAt: null },
      select: { id: true },
    });
    if (!org) return null;

    const deal = await this.prisma.deal.findFirst({
      where: { orgId: org.id, ownerId: userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });

    return deal?.id ?? null;
  }

  // ─── Gmail Message Parser ─────────────────────────────────────────────────

  parseGmailMessage(msg: gmail_v1.Schema$Message): {
    threadId: string;
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    bodyText: string;
    bodyHtml: string;
    date: number;
    isSent: boolean;
  } {
    const headers = msg.payload?.headers ?? [];
    const h = (name: string): string =>
      headers.find((hh) => hh.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

    const addresses = (raw: string): string[] =>
      raw
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

    const { text, html } = this.extractGmailBody(msg.payload);
    const labels = msg.labelIds ?? [];

    return {
      threadId: msg.threadId ?? msg.id ?? '',
      from: h('From'),
      to: addresses(h('To')),
      cc: addresses(h('Cc')),
      bcc: addresses(h('Bcc')),
      subject: h('Subject'),
      bodyText: text,
      bodyHtml: html || text,
      date: parseInt(msg.internalDate ?? `${Date.now()}`, 10),
      isSent: labels.includes('SENT'),
    };
  }

  private extractGmailBody(part: gmail_v1.Schema$MessagePart | undefined): {
    text: string;
    html: string;
  } {
    if (!part) return { text: '', html: '' };

    if (part.mimeType === 'text/plain' && part.body?.data) {
      return { text: Buffer.from(part.body.data, 'base64').toString('utf8'), html: '' };
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64').toString('utf8');
      return { text: html.replace(/<[^>]+>/g, ''), html };
    }

    let text = '';
    let html = '';
    for (const sub of part.parts ?? []) {
      const result = this.extractGmailBody(sub);
      if (result.text) text = result.text;
      if (result.html) html = result.html;
    }
    return { text, html };
  }
}
