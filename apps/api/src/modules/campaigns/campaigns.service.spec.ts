import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CampaignStatus } from '@nextgen/db';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { CAMPAIGN_SEND_QUEUE, CampaignsService } from './campaigns.service';

const makeCampaign = (overrides: Record<string, unknown> = {}) => ({
  id: 'camp-1',
  name: 'Test Campaign',
  subject: 'Hello World',
  bodyHtml: '<p>Hello {{firstName}}</p>',
  previewText: null,
  status: CampaignStatus.DRAFT,
  scheduledAt: null,
  sentAt: null,
  senderId: 'user-1',
  totalRecipients: 0,
  openCount: 0,
  clickCount: 0,
  unsubCount: 0,
  bounceCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  sender: { id: 'user-1', name: 'Alice Smith', email: 'alice@example.com' },
  ...overrides,
});

const makeContact = (overrides: Record<string, unknown> = {}) => ({
  id: 'cc-1',
  campaignId: 'camp-1',
  personId: 'person-1',
  trackingToken: 'camp-1:person-1:open:abcdef01abcdef01',
  sentAt: null,
  openedAt: null,
  clickedAt: null,
  unsubscribedAt: null,
  bouncedAt: null,
  person: { optIn: true, deletedAt: null, firstName: 'Bob', emails: ['bob@acme.com'], org: null },
  campaign: { name: 'Test Campaign' },
  ...overrides,
});

const prismaMock = {
  campaign: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  campaignContact: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  person: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
};

const queueMock = { add: vi.fn() };

describe('CampaignsService', () => {
  let service: CampaignsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Ensure JWT_SECRET is available for HMAC
    process.env.JWT_SECRET = 'test-secret-32-chars-long-enough!!';

    const module = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: getQueueToken(CAMPAIGN_SEND_QUEUE), useValue: queueMock },
      ],
    }).compile();
    service = module.get(CampaignsService);
  });

  // ─── HMAC Tokens ─────────────────────────────────────────────────────────

  describe('generateTrackingToken / validateTrackingToken', () => {
    it('generates a token with 4 colon-separated parts', () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'open');
      expect(token.split(':').length).toBe(4);
    });

    it('validates a correct token', () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'open');
      const result = service.validateTrackingToken(token);
      expect(result).toEqual({ campaignId: 'camp-1', personId: 'person-1', action: 'open' });
    });

    it('returns null for a forged token (tampered sig)', () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'open');
      const tampered = token.slice(0, -4) + 'dead';
      expect(service.validateTrackingToken(tampered)).toBeNull();
    });

    it('returns null for a token with wrong structure', () => {
      expect(service.validateTrackingToken('bad-token')).toBeNull();
      expect(service.validateTrackingToken('a:b:c')).toBeNull();
    });

    it('generates different tokens for different actions', () => {
      const open = service.generateTrackingToken('c', 'p', 'open');
      const click = service.generateTrackingToken('c', 'p', 'click');
      const unsub = service.generateTrackingToken('c', 'p', 'unsub');
      expect(open).not.toBe(click);
      expect(click).not.toBe(unsub);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a campaign with sanitized HTML', async () => {
      const created = makeCampaign();
      prismaMock.campaign.create.mockResolvedValue(created);

      const result = await service.create(
        { name: 'Test', subject: 'Hi', bodyHtml: '<p>Hello</p><script>alert(1)</script>' },
        'user-1',
      );

      expect(result).toEqual(created);
      const callData = prismaMock.campaign.create.mock.calls[0][0].data;
      expect(callData.bodyHtml).not.toContain('<script>');
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated campaigns', async () => {
      const campaigns = [makeCampaign()];
      prismaMock.campaign.findMany.mockResolvedValue(campaigns);
      prismaMock.campaign.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(campaigns);
      expect(result.meta.total).toBe(1);
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns campaign with contacts', async () => {
      const campaign = { ...makeCampaign(), contacts: [makeContact()] };
      prismaMock.campaign.findFirst.mockResolvedValue(campaign);

      const result = await service.findOne('camp-1');
      expect(result.id).toBe('camp-1');
    });

    it('throws NotFoundException for missing campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a DRAFT campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());
      prismaMock.campaign.update.mockResolvedValue(makeCampaign({ subject: 'Updated' }));

      const result = await service.update('camp-1', { subject: 'Updated' });
      expect(result.subject).toBe('Updated');
    });

    it('throws BadRequest when updating a non-DRAFT campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(
        makeCampaign({ status: CampaignStatus.SENT }),
      );
      await expect(service.update('camp-1', { subject: 'X' })).rejects.toThrow(BadRequestException);
    });
  });

  // ─── validateRecipients ──────────────────────────────────────────────────

  describe('validateRecipients', () => {
    it('passes when all recipients have optIn=true', async () => {
      prismaMock.campaignContact.findMany.mockResolvedValue([makeContact()]);
      await expect(service.validateRecipients('camp-1')).resolves.toBeUndefined();
    });

    it('throws DSGVO_VIOLATION when a recipient has optIn=false', async () => {
      prismaMock.campaignContact.findMany.mockResolvedValue([
        makeContact({
          person: { optIn: false, deletedAt: null, firstName: 'Bob', emails: [], org: null },
        }),
      ]);
      await expect(service.validateRecipients('camp-1')).rejects.toThrow(BadRequestException);
    });

    it('throws DSGVO_VIOLATION for deleted person', async () => {
      prismaMock.campaignContact.findMany.mockResolvedValue([
        makeContact({
          person: { optIn: true, deletedAt: new Date(), firstName: 'Bob', emails: [], org: null },
        }),
      ]);
      await expect(service.validateRecipients('camp-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NO_RECIPIENTS when no contacts', async () => {
      prismaMock.campaignContact.findMany.mockResolvedValue([]);
      await expect(service.validateRecipients('camp-1')).rejects.toThrow(BadRequestException);
    });

    it('DSGVO error contains code DSGVO_VIOLATION', async () => {
      prismaMock.campaignContact.findMany.mockResolvedValue([
        makeContact({
          person: { optIn: false, deletedAt: null, firstName: 'X', emails: [], org: null },
        }),
      ]);
      try {
        await service.validateRecipients('camp-1');
      } catch (e) {
        expect((e as BadRequestException).getResponse()).toMatchObject({ code: 'DSGVO_VIOLATION' });
      }
    });
  });

  // ─── sendCampaign ─────────────────────────────────────────────────────────

  describe('sendCampaign', () => {
    it('validates recipients, updates status, and enqueues batches', async () => {
      prismaMock.campaignContact.findMany
        .mockResolvedValueOnce([makeContact()]) // validate call
        .mockResolvedValueOnce([{ id: 'cc-1' }, { id: 'cc-2' }]); // send contacts
      prismaMock.campaign.update.mockResolvedValue(
        makeCampaign({ status: CampaignStatus.SENDING }),
      );
      queueMock.add.mockResolvedValue({});

      await service.sendCampaign('camp-1', 'user-1');

      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: CampaignStatus.SENDING }),
        }),
      );
      expect(queueMock.add).toHaveBeenCalledWith(
        'send-batch',
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('throws when DSGVO validation fails', async () => {
      prismaMock.campaignContact.findMany.mockResolvedValue([
        makeContact({
          person: { optIn: false, deletedAt: null, firstName: 'X', emails: [], org: null },
        }),
      ]);
      await expect(service.sendCampaign('camp-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── addContacts ─────────────────────────────────────────────────────────

  describe('addContacts', () => {
    it('adds persons to campaign and updates totalRecipients', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());
      prismaMock.person.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      prismaMock.campaignContact.createMany.mockResolvedValue({ count: 2 });
      prismaMock.campaignContact.count.mockResolvedValue(2);
      prismaMock.campaign.update.mockResolvedValue({});

      const result = await service.addContacts('camp-1', { personIds: ['p1', 'p2'] });
      expect(result.added).toBe(2);
      expect(result.total).toBe(2);
    });

    it('throws when adding to non-DRAFT campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(
        makeCampaign({ status: CampaignStatus.SENT }),
      );
      await expect(service.addContacts('camp-1', { personIds: ['p1'] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── trackOpen ───────────────────────────────────────────────────────────

  describe('trackOpen', () => {
    it('increments openCount on valid open token', async () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'open');
      prismaMock.campaignContact.findFirst.mockResolvedValue(makeContact({ openedAt: null }));
      prismaMock.campaignContact.update.mockResolvedValue({});
      prismaMock.campaign.update.mockResolvedValue({});

      await service.trackOpen(token);

      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { openCount: { increment: 1 } } }),
      );
    });

    it('ignores invalid token silently', async () => {
      await expect(service.trackOpen('invalid-token')).resolves.toBeUndefined();
      expect(prismaMock.campaignContact.findFirst).not.toHaveBeenCalled();
    });

    it('does not double-count already-opened contact', async () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'open');
      prismaMock.campaignContact.findFirst.mockResolvedValue(makeContact({ openedAt: new Date() }));

      await service.trackOpen(token);
      expect(prismaMock.campaign.update).not.toHaveBeenCalled();
    });
  });

  // ─── trackClick ──────────────────────────────────────────────────────────

  describe('trackClick', () => {
    it('returns the original URL and increments clickCount', async () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'click');
      prismaMock.campaignContact.findFirst.mockResolvedValue(makeContact({ clickedAt: null }));
      prismaMock.campaignContact.update.mockResolvedValue({});
      prismaMock.campaign.update.mockResolvedValue({});

      const url = await service.trackClick(token, 'https://example.com');
      expect(url).toBe('https://example.com');
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { clickCount: { increment: 1 } } }),
      );
    });

    it('returns null on invalid token (prevents open redirect)', async () => {
      const url = await service.trackClick('bad', 'https://fallback.com');
      expect(url).toBeNull();
    });
  });

  // ─── unsubscribe ─────────────────────────────────────────────────────────

  describe('unsubscribe', () => {
    it('sets person.optIn=false and records optOutAt', async () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'unsub');
      prismaMock.campaignContact.findFirst.mockResolvedValue(makeContact({ unsubscribedAt: null }));
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.campaignContact.update.mockResolvedValue({});
      prismaMock.campaign.update.mockResolvedValue({});

      const result = await service.unsubscribe(token);
      expect(result.firstName).toBe('Bob');

      expect(prismaMock.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ optIn: false, optOutAt: expect.any(Date) }),
        }),
      );
    });

    it('throws BadRequest on invalid unsub token', async () => {
      await expect(service.unsubscribe('bad:token:here:0000')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest on wrong action (open token used for unsub)', async () => {
      const openToken = service.generateTrackingToken('camp-1', 'person-1', 'open');
      await expect(service.unsubscribe(openToken)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── generateAiSubjects ───────────────────────────────────────────────────

  describe('generateAiSubjects', () => {
    it('throws ServiceUnavailable when OpenAI not configured', async () => {
      delete process.env.OPENAI_API_KEY;
      // Rebuild service without OPENAI_API_KEY
      const module = await Test.createTestingModule({
        providers: [
          CampaignsService,
          { provide: PrismaService, useValue: prismaMock },
          { provide: getQueueToken(CAMPAIGN_SEND_QUEUE), useValue: queueMock },
        ],
      }).compile();
      const svc = module.get(CampaignsService);
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());

      await expect(svc.generateAiSubjects('camp-1')).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws NotFoundException for missing campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null);
      await expect(service.generateAiSubjects('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── handleSendGridBounce ─────────────────────────────────────────────────

  describe('handleSendGridBounce', () => {
    it('hard bounce sets optIn=false for person', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.campaignContact.findFirst.mockResolvedValue({ id: 'cc-1', campaignId: 'camp-1' });
      prismaMock.campaignContact.update.mockResolvedValue({});
      prismaMock.campaign.update.mockResolvedValue({});
      prismaMock.person.update.mockResolvedValue({});

      await service.handleSendGridBounce([{ email: 'bob@acme.com', event: 'bounce' }]);

      expect(prismaMock.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ optIn: false }) }),
      );
    });

    it('soft bounce increments counter but does not change optIn', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.campaignContact.findFirst.mockResolvedValue({ id: 'cc-1', campaignId: 'camp-1' });
      prismaMock.campaignContact.update.mockResolvedValue({});
      prismaMock.campaign.update.mockResolvedValue({});
      prismaMock.person.update.mockResolvedValue({});

      await service.handleSendGridBounce([{ email: 'bob@acme.com', event: 'deferred' }]);

      // person.update should NOT be called for soft bounce
      expect(prismaMock.person.update).not.toHaveBeenCalled();
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { bounceCount: { increment: 1 } } }),
      );
    });

    it('ignores events with unknown email', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);
      await service.handleSendGridBounce([{ email: 'unknown@x.com', event: 'bounce' }]);
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });
  });

  // ─── injectTracking ───────────────────────────────────────────────────────

  describe('injectTracking', () => {
    it('replaces merge tags', () => {
      const html = service.injectTracking(
        '<p>Hello {{firstName}} from {{orgName}}</p>',
        'camp-1',
        'person-1',
        'Bob',
        'Acme',
      );
      expect(html).toContain('Hello Bob from Acme');
    });

    it('injects open pixel', () => {
      const html = service.injectTracking('<p>Hi</p>', 'camp-1', 'person-1', 'Bob', '');
      expect(html).toContain('/api/v1/public/track/open/');
    });

    it('injects unsubscribe link', () => {
      const html = service.injectTracking('<p>Hi</p>', 'camp-1', 'person-1', 'Bob', '');
      expect(html).toContain('/api/v1/public/unsubscribe/');
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes a DRAFT campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());
      prismaMock.campaign.update.mockResolvedValue({});
      await service.remove('camp-1');
      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });

    it('throws NotFoundException for missing campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequest when deleting a SENDING campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(
        makeCampaign({ status: CampaignStatus.SENDING }),
      );
      await expect(service.remove('camp-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ─── removeContact ────────────────────────────────────────────────────────

  describe('removeContact', () => {
    it('throws NotFoundException when contact not in campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());
      prismaMock.campaignContact.findFirst.mockResolvedValue(null);
      await expect(service.removeContact('camp-1', 'person-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── testSend ─────────────────────────────────────────────────────────────

  describe('testSend', () => {
    it('returns to address and preview', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());
      prismaMock.user.findUnique.mockResolvedValue({ email: 'alice@example.com' });

      const result = await service.testSend('camp-1', 'user-1');
      expect(result.to).toBe('alice@example.com');
      expect(typeof result.preview).toBe('string');
    });

    it('throws NotFoundException for missing campaign', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(null);
      await expect(service.testSend('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for missing user', async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(makeCampaign());
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.testSend('camp-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── validateTrackingToken edge cases ─────────────────────────────────────

  describe('validateTrackingToken edge cases', () => {
    it('returns null for token with mismatched sig length', () => {
      // sig is shorter than 16 chars → timingSafeEqual throws → caught → null
      expect(service.validateTrackingToken('camp:person:open:ab')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(service.validateTrackingToken('')).toBeNull();
    });
  });

  // ─── finalizeCampaignIfComplete ────────────────────────────────────────────

  describe('finalizeCampaignIfComplete', () => {
    it('sets status to SENT when all contacts are sent', async () => {
      prismaMock.campaignContact.count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
      prismaMock.campaign.update.mockResolvedValue({});

      await service.finalizeCampaignIfComplete('camp-1');

      expect(prismaMock.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: CampaignStatus.SENT } }),
      );
    });

    it('does not set SENT when some contacts are still pending', async () => {
      prismaMock.campaignContact.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);

      await service.finalizeCampaignIfComplete('camp-1');
      expect(prismaMock.campaign.update).not.toHaveBeenCalled();
    });

    it('does not set SENT when total is 0', async () => {
      prismaMock.campaignContact.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

      await service.finalizeCampaignIfComplete('camp-1');
      expect(prismaMock.campaign.update).not.toHaveBeenCalled();
    });
  });

  // ─── trackClick already clicked ───────────────────────────────────────────

  describe('trackClick already clicked', () => {
    it('returns url without incrementing if already clicked', async () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'click');
      prismaMock.campaignContact.findFirst.mockResolvedValue(
        makeContact({ clickedAt: new Date() }),
      );

      const url = await service.trackClick(token, 'https://example.com');
      expect(url).toBe('https://example.com');
      expect(prismaMock.campaign.update).not.toHaveBeenCalled();
    });
  });

  // ─── unsubscribe already unsubscribed ────────────────────────────────────

  describe('unsubscribe idempotency', () => {
    it('is idempotent — does not double-count', async () => {
      const token = service.generateTrackingToken('camp-1', 'person-1', 'unsub');
      prismaMock.campaignContact.findFirst.mockResolvedValue(
        makeContact({ unsubscribedAt: new Date() }),
      );
      prismaMock.person.update.mockResolvedValue({});
      prismaMock.campaignContact.update.mockResolvedValue({});
      prismaMock.campaign.update.mockResolvedValue({});

      await service.unsubscribe(token);
      expect(prismaMock.person.update).not.toHaveBeenCalled();
    });
  });
});
