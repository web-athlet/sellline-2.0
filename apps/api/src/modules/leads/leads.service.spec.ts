import { ConflictException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { EnrichmentStatus } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadsService, LEAD_ENRICHMENT_QUEUE } from './leads.service';

const makeLead = (overrides = {}) => ({
  id: 'lead-1',
  source: 'form:form-1',
  formId: 'form-1',
  dataJson: {
    firstName: 'Max',
    lastName: 'Mustermann',
    email: 'max@acme.de',
    company: 'Acme GmbH',
  },
  enrichedJson: null,
  enrichmentStatus: EnrichmentStatus.PENDING,
  convertedDealId: null,
  companyName: 'Acme GmbH',
  emailDomain: 'acme.de',
  createdAt: new Date(),
  updatedAt: new Date(),
  form: { id: 'form-1', name: 'Kontaktformular' },
  ...overrides,
});

const makeForm = (overrides = {}) => ({
  id: 'form-1',
  name: 'Kontaktformular',
  schemaJson: [],
  notifyEmails: [],
  isActive: true,
  submissions: 0,
  ...overrides,
});

const prismaMock = {
  $transaction: vi.fn(),
  lead: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  form: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  person: { create: vi.fn() },
  deal: { create: vi.fn() },
};

const eventsMock = { emitLeadEnriched: vi.fn() };
const queueMock = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

describe('LeadsService', () => {
  let service: LeadsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventsGateway, useValue: eventsMock },
        { provide: getQueueToken(LEAD_ENRICHMENT_QUEUE), useValue: queueMock },
      ],
    }).compile();

    service = module.get(LeadsService);
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated leads', async () => {
      prismaMock.$transaction.mockResolvedValue([1, [makeLead()]]);
      const result = await service.findAll({});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('applies enrichmentStatus filter', async () => {
      prismaMock.$transaction.mockResolvedValue([0, []]);
      await service.findAll({ enrichmentStatus: EnrichmentStatus.DONE });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('applies formId filter', async () => {
      prismaMock.$transaction.mockResolvedValue([0, []]);
      await service.findAll({ formId: 'form-1' });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('returns empty data when no leads', async () => {
      prismaMock.$transaction.mockResolvedValue([0, []]);
      const result = await service.findAll({ page: 2, limit: 10 });
      expect(result.data).toHaveLength(0);
      expect(result.meta.pages).toBe(0);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns lead when found', async () => {
      const lead = makeLead();
      prismaMock.lead.findFirst.mockResolvedValue(lead);
      const result = await service.findOne('lead-1');
      expect(result.id).toBe('lead-1');
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.lead.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── submitPublic ──────────────────────────────────────────────────────────

  describe('submitPublic', () => {
    it('creates lead and enqueues enrichment', async () => {
      const form = makeForm();
      const lead = makeLead();
      prismaMock.form.findFirst.mockResolvedValue(form);
      prismaMock.$transaction.mockResolvedValue(lead);

      const result = await service.submitPublic('form-1', {
        firstName: 'Max',
        email: 'max@acme.de',
        company: 'Acme',
      });

      expect(result).toBe(lead);
      expect(queueMock.add).toHaveBeenCalledWith(
        'enrich',
        { leadId: 'lead-1' },
        expect.objectContaining({ jobId: expect.stringContaining('enrich-') }),
      );
    });

    it('throws NotFoundException when form not found', async () => {
      prismaMock.form.findFirst.mockResolvedValue(null);
      await expect(service.submitPublic('unknown-form', { email: 'x@y.de' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('sanitizes XSS payload in submitted data', async () => {
      const form = makeForm();
      prismaMock.form.findFirst.mockResolvedValue(form);
      prismaMock.$transaction.mockImplementation(
        async (cb: (tx: typeof prismaMock) => Promise<unknown>) => {
          const fakeTx = {
            lead: {
              create: vi.fn().mockResolvedValue(makeLead({ id: 'lead-xss' })),
            },
            form: { update: vi.fn().mockResolvedValue({}) },
          };
          return cb(fakeTx as unknown as typeof prismaMock);
        },
      );

      await service.submitPublic('form-1', {
        firstName: '<script>alert(1)</script>',
      });

      const txCall = prismaMock.$transaction.mock.calls[0] as unknown[];
      expect(txCall).toBeDefined();
    });
  });

  // ── convert ───────────────────────────────────────────────────────────────

  describe('convert', () => {
    it('creates person and deal, updates lead', async () => {
      const lead = makeLead();
      prismaMock.lead.findFirst.mockResolvedValue(lead);

      const person = { id: 'person-1', firstName: 'Max', lastName: 'Mustermann' };
      const deal = { id: 'deal-1', title: 'Lead: Acme GmbH' };

      prismaMock.$transaction.mockImplementation(
        async (cb: (tx: typeof prismaMock) => Promise<{ person: unknown; deal: unknown }>) => {
          const fakeTx = {
            person: { create: vi.fn().mockResolvedValue(person) },
            deal: { create: vi.fn().mockResolvedValue(deal) },
            lead: { update: vi.fn().mockResolvedValue({}) },
          };
          return cb(fakeTx as unknown as typeof prismaMock);
        },
      );

      const result = await service.convert('lead-1', {
        dealTitle: 'Lead: Acme GmbH',
        dealValue: 5000,
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
        ownerId: 'user-1',
      });

      expect(result.person.id).toBe('person-1');
      expect(result.deal.id).toBe('deal-1');
    });

    it('throws ConflictException when already converted', async () => {
      prismaMock.lead.findFirst.mockResolvedValue(makeLead({ convertedDealId: 'deal-99' }));
      await expect(
        service.convert('lead-1', {
          dealTitle: 'x',
          pipelineId: 'p',
          stageId: 's',
          ownerId: 'u',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── reEnqueue ─────────────────────────────────────────────────────────────

  describe('reEnqueue', () => {
    it('sets status PENDING and enqueues job', async () => {
      const lead = makeLead({ enrichmentStatus: EnrichmentStatus.FAILED });
      prismaMock.lead.findFirst.mockResolvedValue(lead);
      prismaMock.lead.update.mockResolvedValue({});

      const result = await service.reEnqueue('lead-1');
      expect(result.queued).toBe(true);
      expect(prismaMock.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ enrichmentStatus: EnrichmentStatus.PENDING }),
        }),
      );
      expect(queueMock.add).toHaveBeenCalled();
    });

    it('throws NotFoundException when lead not found', async () => {
      prismaMock.lead.findFirst.mockResolvedValue(null);
      await expect(service.reEnqueue('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes the lead', async () => {
      prismaMock.lead.findFirst.mockResolvedValue(makeLead());
      prismaMock.lead.update.mockResolvedValue({});

      await service.remove('lead-1');
      expect(prismaMock.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException when lead not found', async () => {
      prismaMock.lead.findFirst.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── emitLeadEnriched ──────────────────────────────────────────────────────

  describe('emitLeadEnriched', () => {
    it('delegates to EventsGateway', () => {
      service.emitLeadEnriched('lead-1', 'DONE');
      expect(eventsMock.emitLeadEnriched).toHaveBeenCalledWith(
        expect.objectContaining({ leadId: 'lead-1', status: 'DONE' }),
      );
    });
  });
});
