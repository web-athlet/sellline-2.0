import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PulseTab } from './dto/query-pulse-feed.dto';
import { calculatePriorityScore, PulseFeedService } from './pulse-feed.service';

const mockPrisma = {
  activity: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  deal: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  stage: {
    groupBy: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  delByPattern: vi.fn().mockResolvedValue(undefined),
};

const mockEvents = {
  emitPulseFeedUpdated: vi.fn(),
} as unknown as EventsGateway;

const user = { id: 'user-1', email: 'u@e.de', role: Role.SALES_REP, twoFactorEnabled: false };

const mockDecimal = (n: number) => ({
  valueOf: () => n,
  toNumber: () => n,
  toString: () => String(n),
});

const makeActivity = (overrides: Record<string, unknown> = {}) => ({
  id: 'act-1',
  type: 'CALL',
  subject: 'Anruf mit Herr Müller',
  done: false,
  dueDate: new Date('2026-05-10'),
  assigneeId: user.id,
  createdAt: new Date(),
  deal: {
    id: 'deal-1',
    title: 'EDV-Angebot',
    value: mockDecimal(45_000),
    currency: 'EUR',
    pipelineId: 'pipe-1',
    owner: { id: user.id, name: 'Mario' },
    org: { id: 'org-1', name: 'Müller GmbH' },
    stage: { order: 3 },
    _count: { activities: 2 },
  },
  ...overrides,
});

const makeDeal = (overrides: Record<string, unknown> = {}) => ({
  id: 'deal-1',
  title: 'EDV-Angebot',
  value: mockDecimal(45_000),
  currency: 'EUR',
  pipelineId: 'pipe-1',
  probability: 80,
  closingDate: null,
  rotIndicator: false,
  owner: { id: user.id, name: 'Mario' },
  org: { id: 'org-1', name: 'Müller GmbH' },
  stage: { order: 3 },
  _count: { activities: 2 },
  ...overrides,
});

describe('calculatePriorityScore', () => {
  it('caps each component at its maximum contribution', () => {
    const score = calculatePriorityScore({
      dealValue: 1_000_000,
      dueDate: new Date(Date.now() - 2 * 86_400_000),
      activitiesLast7d: 10,
      stageIndex: 6,
      totalStages: 6,
    });
    expect(score).toBe(100);
  });

  it('returns 0 for a zero-value new deal with no overdue', () => {
    const score = calculatePriorityScore({
      dealValue: 0,
      dueDate: new Date(Date.now() + 86_400_000), // tomorrow
      activitiesLast7d: 0,
      stageIndex: 0,
      totalStages: 6,
    });
    expect(score).toBe(0);
  });

  it('score > 75 triggers isUrgent threshold', () => {
    const score = calculatePriorityScore({
      dealValue: 100_000,
      dueDate: new Date(Date.now() - 1 * 86_400_000),
      activitiesLast7d: 3,
      stageIndex: 5,
      totalStages: 6,
    });
    expect(score).toBeGreaterThan(75);
  });

  it('priority-score sort differs from date-only sort', () => {
    const old = calculatePriorityScore({
      dealValue: 100,
      dueDate: new Date(Date.now() - 10 * 86_400_000),
      activitiesLast7d: 0,
      stageIndex: 1,
      totalStages: 6,
    });
    const recent = calculatePriorityScore({
      dealValue: 500_000,
      dueDate: new Date(Date.now() - 1 * 86_400_000),
      activitiesLast7d: 3,
      stageIndex: 5,
      totalStages: 6,
    });
    // By date alone, old would rank first — but by score, recent wins
    expect(recent).toBeGreaterThan(old);
  });
});

describe('PulseFeedService', () => {
  let service: PulseFeedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PulseFeedService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: EventsGateway, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<PulseFeedService>(PulseFeedService);
    vi.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
  });

  describe('getFeed — followups', () => {
    it('returns activities with scores sorted descending', async () => {
      mockPrisma.activity.count.mockResolvedValue(1);
      mockPrisma.activity.findMany.mockResolvedValue([makeActivity()]);
      mockPrisma.stage.groupBy.mockResolvedValue([{ pipelineId: 'pipe-1', _count: 6 }]);

      const result = await service.getFeed({ tab: PulseTab.FOLLOWUPS }, user);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.activityId).toBe('act-1');
      expect(result.items[0]?.priorityScore).toBeGreaterThanOrEqual(0);
    });

    it('marks isUrgent when score > 75', async () => {
      const act = {
        id: 'act-1',
        type: 'CALL',
        subject: 'Urgent call',
        done: false,
        dueDate: new Date(Date.now() - 2 * 86_400_000),
        assigneeId: user.id,
        createdAt: new Date(),
        deal: {
          id: 'deal-1',
          title: 'Big Deal',
          value: mockDecimal(500_000),
          currency: 'EUR',
          pipelineId: 'pipe-1',
          owner: { id: user.id, name: 'Mario' },
          org: null,
          stage: { order: 6 },
          _count: { activities: 5 },
        },
      };
      mockPrisma.activity.count.mockResolvedValue(1);
      mockPrisma.activity.findMany.mockResolvedValue([act]);
      mockPrisma.stage.groupBy.mockResolvedValue([{ pipelineId: 'pipe-1', _count: 6 }]);

      const result = await service.getFeed({ tab: PulseTab.FOLLOWUPS }, user);
      expect(result.items[0]?.isUrgent).toBe(true);
    });

    it('returns cached result on cache hit', async () => {
      const cached = { items: [], total: 0, hasMore: false };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getFeed({ tab: PulseTab.FOLLOWUPS }, user);
      expect(result).toEqual(cached);
      expect(mockPrisma.activity.findMany).not.toHaveBeenCalled();
    });

    it('stores result in cache on miss', async () => {
      mockPrisma.activity.count.mockResolvedValue(0);
      mockPrisma.activity.findMany.mockResolvedValue([]);
      mockPrisma.stage.groupBy.mockResolvedValue([]);

      await service.getFeed({ tab: PulseTab.FOLLOWUPS }, user);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`pulse:${user.id}`),
        expect.any(String),
        30,
      );
    });

    it('throws BadRequestException for invalid date', async () => {
      await expect(service.getFeed({ date: 'not-a-date' }, user)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getFeed — missed', () => {
    it('returns deals with rotIndicator or no recent activity', async () => {
      mockPrisma.deal.count.mockResolvedValue(1);
      mockPrisma.deal.findMany.mockResolvedValue([makeDeal({ rotIndicator: true })]);
      mockPrisma.stage.groupBy.mockResolvedValue([{ pipelineId: 'pipe-1', _count: 6 }]);

      const result = await service.getFeed({ tab: PulseTab.MISSED }, user);
      expect(result.items[0]?.dealId).toBe('deal-1');
      expect(result.items[0]?.activityId).toBeNull();
    });
  });

  describe('getFeed — opportunities', () => {
    it('returns high-probability open deals', async () => {
      mockPrisma.deal.count.mockResolvedValue(1);
      mockPrisma.deal.findMany.mockResolvedValue([makeDeal({ probability: 85 })]);
      mockPrisma.stage.groupBy.mockResolvedValue([{ pipelineId: 'pipe-1', _count: 6 }]);

      const result = await service.getFeed({ tab: PulseTab.OPPORTUNITIES }, user);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.dealId).toBe('deal-1');
    });
  });

  describe('getCounts', () => {
    it('returns aggregated counts for all tabs', async () => {
      mockPrisma.activity.count.mockResolvedValue(3);
      mockPrisma.deal.count
        .mockResolvedValueOnce(5) // missed
        .mockResolvedValueOnce(7); // opportunities

      const counts = await service.getCounts(undefined, user);
      expect(counts).toEqual({ followups: 3, missed: 5, opportunities: 7 });
    });

    it('returns cached counts on cache hit', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ followups: 1, missed: 2, opportunities: 3 }),
      );
      const counts = await service.getCounts(undefined, user);
      expect(counts).toEqual({ followups: 1, missed: 2, opportunities: 3 });
      expect(mockPrisma.activity.count).not.toHaveBeenCalled();
    });
  });

  describe('completeActivity', () => {
    it('marks activity done and invalidates cache', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        id: 'act-1',
        assigneeId: user.id,
        done: false,
      });
      mockPrisma.activity.update.mockResolvedValue({});

      await service.completeActivity('act-1', user);
      expect(mockPrisma.activity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'act-1' },
          data: expect.objectContaining({ done: true }),
        }),
      );
      expect(mockRedis.delByPattern).toHaveBeenCalledWith(`pulse:${user.id}:*`);
      expect(mockEvents.emitPulseFeedUpdated).toHaveBeenCalledWith(user.id, 'followups');
    });

    it('throws NotFoundException for unknown activity', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue(null);
      await expect(service.completeActivity('unknown', user)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when activity belongs to another user', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        id: 'act-1',
        assigneeId: 'other-user',
        done: false,
      });
      await expect(service.completeActivity('act-1', user)).rejects.toThrow(ForbiddenException);
    });

    it('is idempotent — no update if already done', async () => {
      mockPrisma.activity.findFirst.mockResolvedValue({
        id: 'act-1',
        assigneeId: user.id,
        done: true,
      });
      await service.completeActivity('act-1', user);
      expect(mockPrisma.activity.update).not.toHaveBeenCalled();
    });
  });
});
