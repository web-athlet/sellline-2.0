import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSyncService } from './email-sync.service';
import { EmailService } from './email.service';

const makeEmail = (overrides = {}) => ({
  id: 'email-1',
  threadId: 'thread-1',
  fromAddress: 'alice@acme.com',
  toAddresses: ['bob@nextgen.com'],
  cc: [],
  bcc: [],
  subject: 'Test Subject',
  bodyPreview: 'Hello world',
  bodyEncrypted: 'enc-body',
  isRead: false,
  isSent: false,
  sentAt: new Date('2026-05-22T10:00:00Z'),
  dealId: null,
  userId: 'user-1',
  createdAt: new Date(),
  deal: null,
  ...overrides,
});

const prismaMock = {
  email: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
};

const encryptionMock = {
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace(/^enc:/, '')),
};

const syncMock = {
  sendGmailMessage: vi.fn(),
  sendOutlookMessage: vi.fn(),
  matchDealByAddress: vi.fn(),
  getOutlookAccessToken: vi.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EncryptionService, useValue: encryptionMock },
        { provide: EmailSyncService, useValue: syncMock },
      ],
    }).compile();
    service = module.get(EmailService);
  });

  // ─── listThreads ─────────────────────────────────────────────────────────

  describe('listThreads', () => {
    it('returns paginated threads for user', async () => {
      const emails = [makeEmail()];
      prismaMock.email.findMany.mockResolvedValue(emails);
      prismaMock.email.count.mockResolvedValue(1);

      const result = await service.listThreads('user-1', { page: 1, limit: 50 });

      expect(result.data).toEqual(emails);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 50, pages: 1 });
      expect(prismaMock.email.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', deletedAt: null }),
        }),
      );
    });

    it('filters by dealId when provided', async () => {
      prismaMock.email.findMany.mockResolvedValue([]);
      prismaMock.email.count.mockResolvedValue(0);

      await service.listThreads('user-1', { dealId: 'deal-1' });

      expect(prismaMock.email.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ dealId: 'deal-1' }) }),
      );
    });

    it('adds search filter when provided', async () => {
      prismaMock.email.findMany.mockResolvedValue([]);
      prismaMock.email.count.mockResolvedValue(0);

      await service.listThreads('user-1', { search: 'invoice' });

      expect(prismaMock.email.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([expect.objectContaining({ subject: expect.anything() })]),
          }),
        }),
      );
    });
  });

  // ─── getThread ────────────────────────────────────────────────────────────

  describe('getThread', () => {
    it('returns thread with emails and marks as read', async () => {
      const emails = [makeEmail(), makeEmail({ id: 'email-2', sentAt: new Date() })];
      prismaMock.email.findMany.mockResolvedValue(emails);
      prismaMock.email.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.getThread('thread-1', 'user-1');

      expect(result.threadId).toBe('thread-1');
      expect(result.emails).toHaveLength(2);
      expect(prismaMock.email.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isRead: false }) }),
      );
    });

    it('throws NotFoundException for unknown thread', async () => {
      prismaMock.email.findMany.mockResolvedValue([]);

      await expect(service.getThread('unknown', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getUnreadCount ───────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns unread count for user', async () => {
      prismaMock.email.count.mockResolvedValue(7);

      const result = await service.getUnreadCount('user-1');

      expect(result).toEqual({ unread: 7 });
      expect(prismaMock.email.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1', isRead: false }),
        }),
      );
    });
  });

  // ─── sendEmail ────────────────────────────────────────────────────────────

  describe('sendEmail', () => {
    const dto = {
      to: ['alice@acme.com'],
      subject: 'Hello',
      bodyHtml: '<p>Hi</p>',
    };

    it('sends via Gmail when gmailTokenEncrypted is set', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        gmailTokenEncrypted: 'enc-token',
        outlookTokenEncrypted: null,
        email: 'bob@nextgen.com',
      });
      syncMock.sendGmailMessage.mockResolvedValue('gmail-msg-id');
      syncMock.matchDealByAddress.mockResolvedValue(null);
      prismaMock.email.create.mockResolvedValue({ id: 'new-email-id' });

      const result = await service.sendEmail('user-1', dto);

      expect(result).toEqual({ emailId: 'new-email-id' });
      expect(syncMock.sendGmailMessage).toHaveBeenCalledWith('user-1', dto);
    });

    it('throws ServiceUnavailableException when no provider connected', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        gmailTokenEncrypted: null,
        outlookTokenEncrypted: null,
        email: 'bob@nextgen.com',
      });

      await expect(service.sendEmail('user-1', dto)).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws NotFoundException when user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.sendEmail('user-1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── summarizeThread ──────────────────────────────────────────────────────

  describe('summarizeThread', () => {
    it('throws ServiceUnavailableException when OpenAI not configured', async () => {
      // OpenAI is not configured (no OPENAI_API_KEY in test env)
      await expect(service.summarizeThread('thread-1', 'user-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('returns skipped:true when thread has < 5 emails', async () => {
      // Inject a mock openai to bypass the null check
      (service as unknown as { openai: unknown }).openai = {};
      prismaMock.email.findMany.mockResolvedValue([
        makeEmail(),
        makeEmail({ id: 'e2' }),
        makeEmail({ id: 'e3' }),
      ]);

      const result = await service.summarizeThread('thread-1', 'user-1');

      expect(result).toMatchObject({ skipped: true });
    });

    it('throws NotFoundException for empty thread', async () => {
      (service as unknown as { openai: unknown }).openai = {};
      prismaMock.email.findMany.mockResolvedValue([]);

      await expect(service.summarizeThread('thread-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getProviders ─────────────────────────────────────────────────────────

  describe('getProviders', () => {
    it('returns connected status for both providers', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        gmailTokenEncrypted: 'token',
        gmailWatchExpiresAt: new Date(),
        outlookTokenEncrypted: null,
        outlookSubscriptionExpiresAt: null,
      });

      const result = await service.getProviders('user-1');

      expect(result.gmail.connected).toBe(true);
      expect(result.outlook.connected).toBe(false);
    });
  });
});
