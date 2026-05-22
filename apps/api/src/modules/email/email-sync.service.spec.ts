import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_POLL_QUEUE, EMAIL_SYNC_QUEUE, EmailSyncService } from './email-sync.service';

const prismaMock = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  email: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  organization: {
    findFirst: vi.fn(),
  },
  deal: {
    findFirst: vi.fn(),
  },
};

const encryptionMock = {
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => {
    if (v.startsWith('enc:')) return v.slice(4);
    return v;
  }),
};

const eventsMock = {
  emitEmailReceived: vi.fn(),
  emitEmailCountUpdated: vi.fn(),
};

const queueMock = {
  add: vi.fn().mockResolvedValue({}),
};

describe('EmailSyncService', () => {
  let service: EmailSyncService;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Restore queue mock after reset (resetAllMocks clears mockResolvedValue)
    queueMock.add.mockResolvedValue({});
    const module = await Test.createTestingModule({
      providers: [
        EmailSyncService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EncryptionService, useValue: encryptionMock },
        { provide: EventsGateway, useValue: eventsMock },
        { provide: getQueueToken(EMAIL_SYNC_QUEUE), useValue: queueMock },
        { provide: getQueueToken(EMAIL_POLL_QUEUE), useValue: queueMock },
      ],
    }).compile();
    service = module.get(EmailSyncService);
  });

  // ─── buildGmailConnectUrl ─────────────────────────────────────────────────

  describe('buildGmailConnectUrl', () => {
    it('throws 503 when GOOGLE_OAUTH_CLIENT_ID is not set', () => {
      const orig = process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;

      expect(() => service.buildGmailConnectUrl('user-1')).toThrow(ServiceUnavailableException);

      process.env.GOOGLE_OAUTH_CLIENT_ID = orig;
    });

    it('returns a Google OAuth URL when client id is set', () => {
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';

      const url = service.buildGmailConnectUrl('user-1');

      expect(url).toContain('accounts.google.com');
      expect(url).toContain('state=');
    });
  });

  // ─── buildOutlookConnectUrl ───────────────────────────────────────────────

  describe('buildOutlookConnectUrl', () => {
    it('throws 503 when MICROSOFT_OAUTH_CLIENT_ID is not set', () => {
      const orig = process.env.MICROSOFT_OAUTH_CLIENT_ID;
      delete process.env.MICROSOFT_OAUTH_CLIENT_ID;

      expect(() => service.buildOutlookConnectUrl('user-1')).toThrow(ServiceUnavailableException);

      process.env.MICROSOFT_OAUTH_CLIENT_ID = orig;
    });

    it('returns Microsoft login URL when client id is set', () => {
      process.env.MICROSOFT_OAUTH_CLIENT_ID = 'test-ms-client';

      const url = service.buildOutlookConnectUrl('user-1');

      expect(url).toContain('login.microsoftonline.com');
      expect(url).toContain('state=');
    });
  });

  // ─── matchDealByAddress ───────────────────────────────────────────────────

  describe('matchDealByAddress', () => {
    it('returns null for address without domain', async () => {
      const result = await service.matchDealByAddress('invalid', 'user-1');
      expect(result).toBeNull();
    });

    it('returns null when no org matches domain', async () => {
      prismaMock.organization.findFirst.mockResolvedValue(null);

      const result = await service.matchDealByAddress('alice@unknown.com', 'user-1');

      expect(result).toBeNull();
    });

    it('returns dealId when org and deal match', async () => {
      prismaMock.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      prismaMock.deal.findFirst.mockResolvedValue({ id: 'deal-1' });

      const result = await service.matchDealByAddress('alice@acme.com', 'user-1');

      expect(result).toBe('deal-1');
      expect(prismaMock.organization.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ domain: 'acme.com' }) }),
      );
    });

    it('returns null when org exists but no deal', async () => {
      prismaMock.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      prismaMock.deal.findFirst.mockResolvedValue(null);

      const result = await service.matchDealByAddress('alice@acme.com', 'user-1');

      expect(result).toBeNull();
    });
  });

  // ─── parseGmailMessage ────────────────────────────────────────────────────

  describe('parseGmailMessage', () => {
    it('parses basic gmail message headers and body', () => {
      const msg = {
        id: 'msg-1',
        threadId: 'thread-1',
        internalDate: `${Date.now()}`,
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'From', value: 'alice@acme.com' },
            { name: 'To', value: 'bob@nextgen.com' },
            { name: 'Subject', value: 'Test' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Hello world').toString('base64') },
        },
      };

      const result = service.parseGmailMessage(msg as never);

      expect(result.from).toBe('alice@acme.com');
      expect(result.to).toEqual(['bob@nextgen.com']);
      expect(result.subject).toBe('Test');
      expect(result.bodyText).toBe('Hello world');
      expect(result.isSent).toBe(false);
    });

    it('detects sent label', () => {
      const msg = {
        id: 'msg-1',
        threadId: 'thread-1',
        internalDate: `${Date.now()}`,
        labelIds: ['SENT'],
        payload: {
          headers: [
            { name: 'From', value: 'alice@acme.com' },
            { name: 'To', value: 'bob@nextgen.com' },
            { name: 'Subject', value: 'Sent mail' },
          ],
          mimeType: 'text/plain',
          body: { data: Buffer.from('Sent body').toString('base64') },
        },
      };

      const result = service.parseGmailMessage(msg as never);

      expect(result.isSent).toBe(true);
    });

    it('extracts html body from multipart message', () => {
      const htmlContent = '<h1>Hello</h1>';
      const msg = {
        id: 'msg-1',
        threadId: 'thread-1',
        internalDate: `${Date.now()}`,
        labelIds: ['INBOX'],
        payload: {
          mimeType: 'multipart/alternative',
          headers: [
            { name: 'From', value: 'alice@acme.com' },
            { name: 'To', value: 'bob@nextgen.com' },
            { name: 'Subject', value: 'HTML email' },
          ],
          body: {},
          parts: [
            { mimeType: 'text/plain', body: { data: Buffer.from('Hello').toString('base64') } },
            { mimeType: 'text/html', body: { data: Buffer.from(htmlContent).toString('base64') } },
          ],
        },
      };

      const result = service.parseGmailMessage(msg as never);

      expect(result.bodyHtml).toBe(htmlContent);
    });
  });

  // ─── disconnectGmail ──────────────────────────────────────────────────────

  describe('disconnectGmail', () => {
    it('clears gmail fields on disconnect', async () => {
      prismaMock.user.update.mockResolvedValue({});

      await service.disconnectGmail('user-1');

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          gmailTokenEncrypted: null,
          gmailHistoryId: null,
          gmailWatchExpiresAt: null,
        },
      });
    });
  });

  // ─── verifyPubSubToken ────────────────────────────────────────────────────

  describe('verifyPubSubToken', () => {
    it('returns false for undefined token', async () => {
      const result = await service.verifyPubSubToken(undefined);
      expect(result).toBe(false);
    });

    it('returns true when GCP_PUBSUB_SA_EMAIL is not set (dev mode)', async () => {
      const orig = process.env.GCP_PUBSUB_SA_EMAIL;
      delete process.env.GCP_PUBSUB_SA_EMAIL;

      const result = await service.verifyPubSubToken('any-token');

      expect(result).toBe(true);
      process.env.GCP_PUBSUB_SA_EMAIL = orig;
    });
  });

  // ─── enqueueGmailSync ─────────────────────────────────────────────────────

  describe('enqueueGmailSync', () => {
    it('adds a job to the sync queue', async () => {
      await service.enqueueGmailSync('user@test.com', '99999');

      expect(queueMock.add).toHaveBeenCalledWith('gmail-history', {
        type: 'gmail',
        emailAddress: 'user@test.com',
        historyId: '99999',
      });
    });
  });

  // ─── onModuleInit ─────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('registers repeatable poll and watch renewal jobs', async () => {
      await service.onModuleInit();

      expect(queueMock.add).toHaveBeenCalledWith(
        'poll-all',
        {},
        expect.objectContaining({ repeat: { pattern: '*/5 * * * *' } }),
      );
      expect(queueMock.add).toHaveBeenCalledWith(
        'renew-watches',
        {},
        expect.objectContaining({ repeat: { pattern: '0 3 * * *' } }),
      );
    });
  });
});
