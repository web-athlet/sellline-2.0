import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelinesService } from './pipelines.service';

const mockPrisma = {
  pipeline: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  deal: {
    groupBy: vi.fn(),
  },
};

describe('PipelinesService', () => {
  let service: PipelinesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PipelinesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(PipelinesService);
    vi.clearAllMocks();
  });

  describe('findOne', () => {
    it('throws NotFoundException when missing', async () => {
      mockPrisma.pipeline.findFirst.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('summary', () => {
    it('aggregates count + totalValue + weightedValue per stage', async () => {
      mockPrisma.pipeline.findFirst.mockResolvedValue({
        id: 'p1',
        stages: [
          { id: 's1', name: 'Qualifiziert', color: null, order: 0 },
          { id: 's2', name: 'Angebot', color: null, order: 1 },
        ],
      });
      mockPrisma.deal.groupBy.mockResolvedValue([
        {
          stageId: 's1',
          _count: { _all: 3 },
          _sum: { value: new Prisma.Decimal(30000) },
          _avg: { probability: 20 },
        },
        {
          stageId: 's2',
          _count: { _all: 2 },
          _sum: { value: new Prisma.Decimal(80000) },
          _avg: { probability: 60 },
        },
      ]);

      const res = await service.summary('p1');
      expect(res.stages).toHaveLength(2);
      const s1 = res.stages.find((s) => s.id === 's1')!;
      expect(s1.count).toBe(3);
      expect(s1.totalValue).toBe(30000);
      expect(s1.weightedValue).toBe(6000); // 30000 * 20 / 100
      const s2 = res.stages.find((s) => s.id === 's2')!;
      expect(s2.weightedValue).toBe(48000); // 80000 * 60 / 100
    });

    it('returns zero rows for stages without deals', async () => {
      mockPrisma.pipeline.findFirst.mockResolvedValue({
        id: 'p1',
        stages: [{ id: 's-empty', name: 'Empty', color: null, order: 0 }],
      });
      mockPrisma.deal.groupBy.mockResolvedValue([]);
      const res = await service.summary('p1');
      expect(res.stages[0]).toMatchObject({ count: 0, totalValue: 0, weightedValue: 0 });
    });
  });

  describe('findAll', () => {
    it('orders default pipeline first', async () => {
      mockPrisma.pipeline.findMany.mockResolvedValue([
        { id: 'p1', isDefault: true, stages: [] },
        { id: 'p2', isDefault: false, stages: [] },
      ]);
      const res = await service.findAll();
      expect(res).toHaveLength(2);
      expect(mockPrisma.pipeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        }),
      );
    });
  });
});
