import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { DealsService } from './deals.service';

const mockPrisma = {
  deal: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  stage: { findFirst: vi.fn() },
  dealProduct: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

const mockEvents = {
  emitDealCreated: vi.fn(),
  emitDealUpdated: vi.fn(),
  emitDealStageChanged: vi.fn(),
  emitDealDeleted: vi.fn(),
  emitDealRotIndicator: vi.fn(),
} as unknown as EventsGateway;

const owner = {
  id: 'owner-1',
  email: 'o@e.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
};
const admin = { ...owner, id: 'admin-1', role: Role.ADMIN };
const stranger = { ...owner, id: 'other', role: Role.SALES_REP };

const baseDeal = {
  id: 'deal-1',
  ownerId: owner.id,
  pipelineId: 'pipe-1',
  stageId: 'stage-1',
  wonAt: null,
  lostAt: null,
};

describe('DealsService', () => {
  let service: DealsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventsGateway, useValue: mockEvents },
      ],
    }).compile();
    service = module.get<DealsService>(DealsService);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns paginated deals with default sort (stage, order)', async () => {
      mockPrisma.$transaction.mockResolvedValue([2, [{ id: 'd1' }, { id: 'd2' }]]);
      const result = await service.findAll({ page: 1, limit: 50 });
      expect(result.meta.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('honours stageId filter', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []]);
      await service.findAll({ stageId: 'stage-x' });
      // First call is the count() promise, second is findMany() — both must
      // include stageId in the WHERE clause.
      expect(mockPrisma.deal.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stageId: 'stage-x', deletedAt: null }),
        }),
      );
      expect(mockPrisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ stageId: 'stage-x' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when missing', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns the deal with relations', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ id: 'deal-1' });
      const res = await service.findOne('deal-1');
      expect(res.id).toBe('deal-1');
    });
  });

  describe('create', () => {
    it('rejects when stage does not belong to the pipeline', async () => {
      mockPrisma.stage.findFirst.mockResolvedValue(null);
      await expect(
        service.create({ title: 't', pipelineId: 'pipe-1', stageId: 'wrong' }, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('defaults ownerId to caller + computes next order in stage', async () => {
      mockPrisma.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrisma.deal.aggregate.mockResolvedValue({ _max: { order: 4 } });
      mockPrisma.deal.create.mockResolvedValue({
        id: 'new-deal',
        pipelineId: 'pipe-1',
        stageId: 'stage-1',
        order: 5,
      });
      mockPrisma.auditLog.create.mockResolvedValue({});

      await service.create({ title: 'Test', pipelineId: 'pipe-1', stageId: 'stage-1' }, owner);
      expect(mockPrisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ownerId: owner.id, order: 5 }),
        }),
      );
      expect(mockEvents.emitDealCreated).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('forbids non-owner SALES_REPs from editing', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      await expect(service.update('deal-1', { title: 'x' }, stranger)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks stage changes via PATCH /:id (route guard)', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      await expect(service.update('deal-1', { stageId: 'stage-2' }, owner)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows manager/admin to edit any deal', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ ...baseDeal, ownerId: 'someone-else' });
      mockPrisma.deal.update.mockResolvedValue({ ...baseDeal, title: 'patched' });
      mockPrisma.auditLog.create.mockResolvedValue({});
      const res = await service.update('deal-1', { title: 'patched' }, admin);
      expect(res.title).toBe('patched');
    });
  });

  describe('remove', () => {
    it('soft-deletes the deal and emits WS event', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.deal.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      await service.remove('deal-1', owner);
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
      expect(mockEvents.emitDealDeleted).toHaveBeenCalled();
    });
  });

  describe('changeStage', () => {
    it('rejects stage from a different pipeline', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.stage.findFirst.mockResolvedValue(null);
      await expect(
        service.changeStage('deal-1', { stageId: 'foreign-stage' }, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('shifts higher cards down + emits stage_changed', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.stage.findFirst.mockResolvedValue({ id: 'stage-2' });
      mockPrisma.deal.aggregate.mockResolvedValue({ _max: { order: 7 } });

      const tx = {
        deal: { updateMany: vi.fn(), update: vi.fn().mockResolvedValue({ id: 'deal-1' }) },
        auditLog: { create: vi.fn() },
      };
      mockPrisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));

      await service.changeStage('deal-1', { stageId: 'stage-2', order: 0 }, owner);

      expect(tx.deal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { order: { increment: 1 } },
        }),
      );
      expect(tx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'deal.stage_change' }),
        }),
      );
      expect(mockEvents.emitDealStageChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          oldStageId: 'stage-1',
          newStageId: 'stage-2',
          order: 0,
        }),
      );
    });
  });

  describe('markWon / markLost', () => {
    it('refuses to win an already-won deal', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue({ ...baseDeal, wonAt: new Date() });
      await expect(service.markWon('deal-1', owner)).rejects.toThrow(BadRequestException);
    });

    it('marks won and sets probability=100', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.deal.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      await service.markWon('deal-1', owner);
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ probability: 100, wonAt: expect.any(Date) }),
        }),
      );
    });

    it('marks lost with required reason', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.deal.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      await service.markLost('deal-1', { lostReason: 'budget cut' }, owner);
      expect(mockPrisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ probability: 0, lostReason: 'budget cut' }),
        }),
      );
    });
  });

  describe('snoozeGhosting', () => {
    it('clears rotIndicator and emits both rot + updated events', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.deal.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});
      await service.snoozeGhosting('deal-1', { days: 7 }, owner);
      expect(mockEvents.emitDealRotIndicator).toHaveBeenCalledWith(
        expect.objectContaining({ rotIndicator: false }),
      );
      expect(mockEvents.emitDealUpdated).toHaveBeenCalled();
    });
  });

  describe('products', () => {
    it('computes percent-discount line total correctly', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.dealProduct.create.mockResolvedValue({});
      mockPrisma.dealProduct.aggregate.mockResolvedValue({
        _sum: { total: new Prisma.Decimal(95) },
      });
      mockPrisma.deal.update.mockResolvedValue({});
      await service.addProduct(
        'deal-1',
        { productId: 'p1', quantity: 2, unitPrice: 50, discount: 5, taxPct: 0 },
        owner,
      );
      // 2 * 50 = 100; -5% = 95; total = 95
      expect(mockPrisma.dealProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total: expect.anything(),
          }),
        }),
      );
      const createArgs = mockPrisma.dealProduct.create.mock.calls[0][0] as {
        data: { total: Prisma.Decimal };
      };
      expect(createArgs.data.total.toString()).toBe('95');
    });

    it('refuses to remove products from a missing line', async () => {
      mockPrisma.deal.findFirst.mockResolvedValue(baseDeal);
      mockPrisma.dealProduct.findFirst.mockResolvedValue(null);
      await expect(service.removeProduct('deal-1', 'missing', owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
