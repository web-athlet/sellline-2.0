import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { InsightsService } from './insights.service';

const makeActivity = (overrides = {}) => ({
  type: 'CALL',
  done: false,
  _count: { id: 1 },
  ...overrides,
});

const prismaMock = {
  deal: {
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  activity: {
    groupBy: vi.fn(),
  },
  lead: {
    groupBy: vi.fn(),
  },
  campaign: {
    findMany: vi.fn(),
  },
  aIInsight: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
};

describe('InsightsService', () => {
  let service: InsightsService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default: count returns 0
    prismaMock.deal.count.mockResolvedValue(0);

    const module = await Test.createTestingModule({
      providers: [
        InsightsService,
        { provide: PrismaService, useValue: prismaMock },
        // SchedulerRegistry mock not needed for unit tests
      ],
    }).compile();

    service = module.get(InsightsService);
  });

  // ── dealConversionRate ─────────────────────────────────────────────────────

  describe('dealConversionRate', () => {
    it('returns labels, datasets and summary', async () => {
      prismaMock.deal.count.mockResolvedValue(3);
      const result = await service.dealConversionRate({ from: '2026-01-01', to: '2026-01-31' });
      expect(result.labels.length).toBeGreaterThan(0);
      expect(result.datasets).toHaveLength(3);
      expect(result.datasets[0]?.label).toBe('Gewonnen');
      expect(result.summary).toHaveProperty('conversionRate');
    });

    it('returns 0% conversion when no closed deals', async () => {
      prismaMock.deal.count.mockResolvedValue(0);
      const result = await service.dealConversionRate({});
      expect(result.summary.conversionRate).toBe(0);
    });

    it('filters by pipelineId and userId', async () => {
      prismaMock.deal.count.mockResolvedValue(1);
      await service.dealConversionRate({ pipelineId: 'pipe-1', userId: 'user-1' });
      expect(prismaMock.deal.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ pipelineId: 'pipe-1', ownerId: 'user-1' }),
        }),
      );
    });
  });

  // ── revenueForecast ────────────────────────────────────────────────────────

  describe('revenueForecast', () => {
    it('returns forecast with 3 months of labels', async () => {
      prismaMock.deal.findMany.mockResolvedValue([
        { value: '10000', probability: 50, closingDate: new Date(Date.now() + 86400000 * 30) },
      ]);
      const result = await service.revenueForecast({});
      expect(result.labels.length).toBeGreaterThanOrEqual(1);
      expect(result.datasets[0]?.label).toBe('Prognose (€)');
      expect(result.summary).toHaveProperty('totalForecast');
    });

    it('calculates weighted forecast (value × probability)', async () => {
      const closingDate = new Date();
      closingDate.setDate(closingDate.getDate() + 10);
      prismaMock.deal.findMany.mockResolvedValue([
        { value: '10000', probability: 60, closingDate },
      ]);
      const result = await service.revenueForecast({});
      expect(result.summary.totalForecast).toBe(6000);
    });

    it('returns empty forecast when no open deals', async () => {
      prismaMock.deal.findMany.mockResolvedValue([]);
      const result = await service.revenueForecast({});
      expect(result.summary.totalForecast).toBe(0);
    });
  });

  // ── activityPerformance ────────────────────────────────────────────────────

  describe('activityPerformance', () => {
    it('returns done and pending datasets', async () => {
      prismaMock.activity.groupBy.mockResolvedValue([
        makeActivity({ type: 'CALL', done: true, _count: { id: 5 } }),
        makeActivity({ type: 'CALL', done: false, _count: { id: 2 } }),
        makeActivity({ type: 'EMAIL', done: false, _count: { id: 3 } }),
      ]);
      const result = await service.activityPerformance({});
      expect(result.datasets.find((d) => d.label === 'Erledigt')?.data).toEqual(
        expect.arrayContaining([5]),
      );
      expect(result.summary.completionRate).toBe(50);
    });

    it('returns 0% completion when no activities', async () => {
      prismaMock.activity.groupBy.mockResolvedValue([]);
      const result = await service.activityPerformance({});
      expect(result.summary.completionRate).toBe(0);
    });
  });

  // ── wonVsLostDeals ─────────────────────────────────────────────────────────

  describe('wonVsLostDeals', () => {
    it('returns won and lost datasets', async () => {
      prismaMock.deal.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
      const result = await service.wonVsLostDeals({ from: '2026-01-01', to: '2026-01-07' });
      expect(result.datasets.find((d) => d.label === 'Gewonnen')).toBeDefined();
      expect(result.summary).toHaveProperty('winRate');
    });

    it('calculates win rate correctly', async () => {
      // 3 won, 1 lost = 75% win rate per call pair
      prismaMock.deal.count
        .mockResolvedValueOnce(3) // won week 1
        .mockResolvedValueOnce(1); // lost week 1
      const result = await service.wonVsLostDeals({ from: '2026-01-01', to: '2026-01-07' });
      expect(result.summary.winRate).toBe(75);
    });
  });

  // ── pipelineVelocity ───────────────────────────────────────────────────────

  describe('pipelineVelocity', () => {
    it('calculates average days per stage', async () => {
      const created = new Date('2026-01-01');
      const closed = new Date('2026-01-21');
      prismaMock.deal.findMany.mockResolvedValue([
        { createdAt: created, closedAt: closed, value: '5000', stage: { name: 'Proposal' } },
      ]);
      const result = await service.pipelineVelocity({});
      expect(result.labels).toContain('Proposal');
      expect(result.summary.overallAvgDays).toBe(20);
    });

    it('returns empty result when no closed deals', async () => {
      prismaMock.deal.findMany.mockResolvedValue([]);
      const result = await service.pipelineVelocity({});
      expect(result.summary.closedDealsCount).toBe(0);
    });
  });

  // ── leadSources ────────────────────────────────────────────────────────────

  describe('leadSources', () => {
    it('groups leads by source', async () => {
      prismaMock.lead.groupBy.mockResolvedValue([
        { source: 'website', _count: { id: 10 } },
        { source: 'referral', _count: { id: 5 } },
      ]);
      const result = await service.leadSources({});
      expect(result.labels).toEqual(['website', 'referral']);
      expect(result.summary.topSource).toBe('website');
      expect(result.summary.total).toBe(15);
    });

    it('returns empty result when no leads', async () => {
      prismaMock.lead.groupBy.mockResolvedValue([]);
      const result = await service.leadSources({});
      expect(result.summary.total).toBe(0);
      expect(result.summary.topSource).toBe('N/A');
    });
  });

  // ── emailPerformance ───────────────────────────────────────────────────────

  describe('emailPerformance', () => {
    it('calculates open/click/bounce rates per campaign', async () => {
      prismaMock.campaign.findMany.mockResolvedValue([
        {
          name: 'Summer Sale',
          totalRecipients: 100,
          openCount: 40,
          clickCount: 10,
          bounceCount: 2,
          unsubCount: 1,
        },
      ]);
      const result = await service.emailPerformance({});
      expect(result.labels).toContain('Summer Sale');
      expect(result.datasets.find((d) => d.label === 'Öffnungsrate (%)')?.data[0]).toBe(40);
      expect(result.summary.avgOpenRate).toBe(40);
    });

    it('handles zero recipients gracefully', async () => {
      prismaMock.campaign.findMany.mockResolvedValue([
        {
          name: 'Empty',
          totalRecipients: 0,
          openCount: 0,
          clickCount: 0,
          bounceCount: 0,
          unsubCount: 0,
        },
      ]);
      const result = await service.emailPerformance({});
      expect(result.datasets[0]?.data[0]).toBe(0);
    });
  });

  // ── revenueByUser ──────────────────────────────────────────────────────────

  describe('revenueByUser', () => {
    it('aggregates revenue per user sorted descending', async () => {
      prismaMock.deal.findMany.mockResolvedValue([
        { value: '3000', owner: { id: 'u1', name: 'Alice' } },
        { value: '7000', owner: { id: 'u2', name: 'Bob' } },
        { value: '2000', owner: { id: 'u1', name: 'Alice' } },
      ]);
      const result = await service.revenueByUser({});
      expect(result.labels[0]).toBe('Bob');
      expect(result.datasets[0]?.data[0]).toBe(7000);
      expect(result.summary.totalRevenue).toBe(12000);
    });

    it('returns empty result when no won deals', async () => {
      prismaMock.deal.findMany.mockResolvedValue([]);
      const result = await service.revenueByUser({});
      expect(result.summary.topPerformer).toBe('N/A');
    });
  });

  // ── getReport dispatch ─────────────────────────────────────────────────────

  describe('getReport', () => {
    it('dispatches to correct report method', async () => {
      prismaMock.deal.count.mockResolvedValue(0);
      const result = await service.getReport('leadSources', {});
      prismaMock.lead.groupBy.mockResolvedValue([]);
      expect(result).toHaveProperty('labels');
    });

    it('throws on unknown report type', async () => {
      await expect(service.getReport('nonExistent', {})).rejects.toThrow('Unknown report type');
    });
  });

  // ── Loss Analysis ──────────────────────────────────────────────────────────

  describe('triggerLossAnalysis', () => {
    it('saves insight without OPENAI_API_KEY (graceful stub)', async () => {
      // openai is null when key missing — service was constructed without key
      prismaMock.aIInsight.create.mockResolvedValue({
        id: 'ins-1',
        type: 'loss_analysis',
        content: { reasons: [] },
        createdAt: new Date(),
      });
      prismaMock.deal.findMany.mockResolvedValue([]);
      const result = await service.triggerLossAnalysis();
      expect(prismaMock.aIInsight.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'loss_analysis' }) }),
      );
      expect(result).toBeDefined();
    });

    it('DSGVO: payload does NOT contain bodyEncrypted', async () => {
      prismaMock.deal.findMany.mockResolvedValue([
        {
          id: 'd1',
          value: 5000,
          lostReason: 'Price',
          lostAt: new Date(),
          createdAt: new Date(Date.now() - 86400000 * 10),
          activities: [],
          emails: [{ bodyPreview: 'Hi there' }],
        },
      ]);
      prismaMock.aIInsight.create.mockResolvedValue({
        id: 'ins-1',
        type: 'loss_analysis',
        content: {},
        createdAt: new Date(),
      });

      // Capture what was passed to prisma
      await service.triggerLossAnalysis();

      // The openai call is null so it goes to the stub path — check prisma.aIInsight.create called
      expect(prismaMock.aIInsight.create).toHaveBeenCalled();
      // Verify no bodyEncrypted in any findMany call args
      const findManyCalls = prismaMock.deal.findMany.mock.calls;
      for (const call of findManyCalls) {
        const include = call[0]?.include;
        if (include?.emails) {
          expect(include.emails.select).not.toHaveProperty('bodyEncrypted');
        }
      }
    });
  });

  // ── getLatestLossInsight ───────────────────────────────────────────────────

  describe('getLatestLossInsight', () => {
    it('returns latest loss_analysis insight', async () => {
      const insight = {
        id: 'ins-1',
        type: 'loss_analysis',
        content: { reasons: [] },
        createdAt: new Date(),
      };
      prismaMock.aIInsight.findFirst.mockResolvedValue(insight);
      const result = await service.getLatestLossInsight();
      expect(result).toEqual(insight);
      expect(prismaMock.aIInsight.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'loss_analysis' } }),
      );
    });
  });
});
