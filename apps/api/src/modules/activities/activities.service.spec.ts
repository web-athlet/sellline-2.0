import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { ActivityType, Priority, Role } from '@nextgen/db';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { PulseFeedService } from '../pulse-feed/pulse-feed.service';
import { ActivitiesService, DEAL_SCORING_QUEUE } from './activities.service';
import { ActivityFilter } from './dto/query-activities.dto';

const makeUser = (overrides = {}) => ({
  id: 'user-1',
  email: 'sales@test.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
  ...overrides,
});

const makeActivity = (overrides = {}) => ({
  id: 'act-1',
  type: ActivityType.TASK,
  subject: 'Demo call',
  notes: null,
  dueDate: null,
  startTime: null,
  endTime: null,
  done: false,
  doneAt: null,
  priority: Priority.NORMAL,
  dealId: 'deal-1',
  personId: null,
  orgId: null,
  assigneeId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  deal: null,
  person: null,
  org: null,
  assignee: { id: 'user-1', name: 'Sales', email: 'sales@test.de' },
  ...overrides,
});

const prismaMock = {
  $transaction: vi.fn(),
  activity: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn().mockResolvedValue({}) },
};

const eventsMock = {
  emitActivityCompleted: vi.fn(),
  emitActivityCreated: vi.fn(),
  emitActivityUpdated: vi.fn(),
};

const pulseFeedMock = { invalidateForUser: vi.fn().mockResolvedValue(undefined) };
const queueMock = { add: vi.fn().mockResolvedValue({ id: 'job-1' }) };

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventsGateway, useValue: eventsMock },
        { provide: PulseFeedService, useValue: pulseFeedMock },
        { provide: getQueueToken(DEAL_SCORING_QUEUE), useValue: queueMock },
      ],
    }).compile();

    service = module.get(ActivitiesService);
  });

  // ── findOne ──────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns activity when found', async () => {
      const act = makeActivity();
      prismaMock.activity.findFirst.mockResolvedValue(act);
      await expect(service.findOne('act-1')).resolves.toEqual(act);
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.activity.findFirst.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a task activity and emits WS event', async () => {
      const act = makeActivity();
      prismaMock.activity.create.mockResolvedValue(act);

      const dto = {
        type: ActivityType.TASK,
        subject: 'Demo call',
        dealId: 'deal-1',
        _linkedEntity: undefined as undefined,
      };

      const result = await service.create(dto, makeUser());
      expect(result).toEqual(act);
      expect(eventsMock.emitActivityCreated).toHaveBeenCalledWith(
        expect.objectContaining({ activityId: 'act-1', dealId: 'deal-1' }),
      );
    });

    it('checks conflicts before creating a meeting and rejects on conflict', async () => {
      prismaMock.activity.findMany.mockResolvedValue([
        makeActivity({
          id: 'conflict-1',
          type: ActivityType.MEETING,
          subject: 'Conflicting',
          startTime: new Date('2026-05-12T10:00:00Z'),
          endTime: new Date('2026-05-12T11:00:00Z'),
        }),
      ]);

      const dto = {
        type: ActivityType.MEETING,
        subject: 'New meeting',
        dealId: 'deal-1',
        startTime: '2026-05-12T10:00:00Z',
        endTime: '2026-05-12T11:00:00Z',
        _linkedEntity: undefined as undefined,
      };

      await expect(service.create(dto, makeUser())).rejects.toThrow(BadRequestException);
    });
  });

  // ── markDone ─────────────────────────────────────────────────────────────

  describe('markDone', () => {
    it('marks done, enqueues scoring job, invalidates pulse, emits WS', async () => {
      const existing = makeActivity({ done: false });
      const doneAct = makeActivity({ done: true, doneAt: new Date() });

      prismaMock.activity.findFirst.mockResolvedValue(existing);
      prismaMock.activity.update.mockResolvedValue(doneAct);

      await service.markDone('act-1', makeUser());

      expect(prismaMock.activity.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ done: true }) }),
      );
      expect(queueMock.add).toHaveBeenCalledWith(
        'score-deal',
        expect.objectContaining({ dealId: 'deal-1' }),
        expect.objectContaining({ jobId: 'scoring-deal-1', delay: 60_000 }),
      );
      expect(pulseFeedMock.invalidateForUser).toHaveBeenCalledWith('user-1');
      expect(eventsMock.emitActivityCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ activityId: 'act-1' }),
      );
    });

    it('throws if activity already done', async () => {
      prismaMock.activity.findFirst.mockResolvedValue(makeActivity({ done: true }));
      await expect(service.markDone('act-1', makeUser())).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException if not assignee or admin', async () => {
      prismaMock.activity.findFirst.mockResolvedValue(
        makeActivity({ assigneeId: 'someone-else', done: false }),
      );
      const user = makeUser({ id: 'other-user', role: Role.SALES_REP });
      await expect(service.markDone('act-1', user)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── checkConflicts ────────────────────────────────────────────────────────

  describe('checkConflicts', () => {
    it('returns empty list when no overlap', async () => {
      prismaMock.activity.findMany.mockResolvedValue([]);
      const dto = { startTime: '2026-05-12T10:00:00Z', endTime: '2026-05-12T11:00:00Z' };
      const result = await service.checkConflicts(dto, makeUser());
      expect(result.conflicts).toHaveLength(0);
    });

    it('returns conflicts when meetings overlap', async () => {
      prismaMock.activity.findMany.mockResolvedValue([
        {
          id: 'act-2',
          subject: 'Existing',
          startTime: new Date('2026-05-12T10:30:00Z'),
          endTime: new Date('2026-05-12T11:30:00Z'),
        },
      ]);
      const dto = { startTime: '2026-05-12T10:00:00Z', endTime: '2026-05-12T11:00:00Z' };
      const result = await service.checkConflicts(dto, makeUser());
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]!.id).toBe('act-2');
    });
  });

  // ── date filter ───────────────────────────────────────────────────────────

  describe('findAll date filters', () => {
    function setupFindAllMocks() {
      prismaMock.$transaction.mockImplementation(async (ops: unknown[]) =>
        Promise.all(ops.map((op) => op as Promise<unknown>)),
      );
      prismaMock.activity.count.mockResolvedValue(0);
      prismaMock.activity.findMany.mockResolvedValue([]);
    }

    it('todo filter returns done:false with gte dueDate', async () => {
      setupFindAllMocks();
      await service.findAll({ filter: ActivityFilter.TODO });
      expect(prismaMock.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            done: false,
            dueDate: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('overdue filter returns done:false with lt dueDate', async () => {
      setupFindAllMocks();
      await service.findAll({ filter: ActivityFilter.OVERDUE });
      expect(prismaMock.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            done: false,
            dueDate: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('today filter returns dueDate between todayStart and todayEnd', async () => {
      setupFindAllMocks();
      await service.findAll({ filter: ActivityFilter.TODAY });
      expect(prismaMock.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('this_week filter returns dueDate within current week', async () => {
      setupFindAllMocks();
      await service.findAll({ filter: ActivityFilter.THIS_WEEK });
      expect(prismaMock.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('next_week filter returns dueDate within next week', async () => {
      setupFindAllMocks();
      await service.findAll({ filter: ActivityFilter.NEXT_WEEK });
      expect(prismaMock.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('range filter with from+to returns bounded dueDate filter', async () => {
      setupFindAllMocks();
      await service.findAll({
        filter: ActivityFilter.RANGE,
        from: '2026-05-01',
        to: '2026-05-31',
      });
      expect(prismaMock.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('range filter throws BadRequest when from/to missing', async () => {
      await expect(service.findAll({ filter: ActivityFilter.RANGE })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes by setting deletedAt', async () => {
      prismaMock.activity.findFirst.mockResolvedValue(makeActivity());
      prismaMock.activity.update.mockResolvedValue({});

      await service.remove('act-1', makeUser());

      expect(prismaMock.activity.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });
});
