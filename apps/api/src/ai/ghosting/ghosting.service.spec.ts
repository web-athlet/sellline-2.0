import { subDays } from 'date-fns';
import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { GhostingService } from './ghosting.service';

const STAGES = [
  { id: 's1', pipelineId: 'p1', order: 0 },
  { id: 's2', pipelineId: 'p1', order: 1 },
  { id: 's3', pipelineId: 'p1', order: 2 }, // final stage → excluded
];

const makeDeal = (overrides = {}) => ({
  id: 'd1',
  title: 'Acme Deal',
  ownerId: 'u1',
  pipelineId: 'p1',
  createdAt: subDays(new Date(), 30),
  ghostedAt: null,
  activities: [] as { createdAt: Date; doneAt: Date | null }[],
  emails: [] as { sentAt: Date }[],
  ...overrides,
});

const prismaMock = {
  stage: { findMany: vi.fn() },
  deal: { findMany: vi.fn(), update: vi.fn() },
  activity: { findFirst: vi.fn(), create: vi.fn() },
  aIInsight: { create: vi.fn() },
};
const eventsMock = { emitDealUpdated: vi.fn() };

const make = () =>
  new GhostingService(
    prismaMock as unknown as PrismaService,
    eventsMock as unknown as EventsGateway,
  );

describe('GhostingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stage.findMany.mockResolvedValue(STAGES);
    prismaMock.deal.findMany.mockResolvedValue([]);
    prismaMock.deal.update.mockResolvedValue({});
    prismaMock.activity.findFirst.mockResolvedValue(null);
    prismaMock.activity.create.mockResolvedValue({});
    prismaMock.aIInsight.create.mockResolvedValue({});
  });

  it('flags a silent deal, creates one follow-up task and an insight (AC-027)', async () => {
    prismaMock.deal.findMany.mockResolvedValue([makeDeal()]);

    const flagged = await make().detectGhosting();

    expect(flagged).toBe(1);
    expect(prismaMock.deal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1' }, data: { ghostedAt: expect.any(Date) } }),
    );
    expect(prismaMock.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'TASK',
          priority: 'HIGH',
          assigneeId: 'u1',
          subject: expect.stringContaining('Ghosting-Follow-up'),
        }),
      }),
    );
    const insight = prismaMock.aIInsight.create.mock.calls[0]![0].data;
    expect(insight.type).toBe('ghosting_detected');
    expect(insight.content.daysSilent).toBeGreaterThanOrEqual(14);
    expect(eventsMock.emitDealUpdated).toHaveBeenCalled();
  });

  it('excludes won/lost/snoozed deals and the final stage in the query', async () => {
    await make().detectGhosting();
    const where = prismaMock.deal.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      wonAt: null,
      lostAt: null,
      deletedAt: null,
      stageId: { notIn: ['s3'] },
    });
    expect(where.OR).toEqual([
      { ghostingSnoozedUntil: null },
      { ghostingSnoozedUntil: { lt: expect.any(Date) } },
    ]);
  });

  it('is idempotent: a deal already flagged (ghostedAt set) is skipped', async () => {
    prismaMock.deal.findMany.mockResolvedValue([makeDeal({ ghostedAt: new Date() })]);
    const flagged = await make().detectGhosting();
    expect(flagged).toBe(0);
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
    expect(prismaMock.activity.create).not.toHaveBeenCalled();
  });

  it('does not flag a deal with recent activity', async () => {
    prismaMock.deal.findMany.mockResolvedValue([
      makeDeal({ activities: [{ createdAt: subDays(new Date(), 2), doneAt: null }] }),
    ]);
    expect(await make().detectGhosting()).toBe(0);
    expect(prismaMock.deal.update).not.toHaveBeenCalled();
  });

  it('does not duplicate the follow-up task when an open one already exists', async () => {
    prismaMock.deal.findMany.mockResolvedValue([makeDeal()]);
    prismaMock.activity.findFirst.mockResolvedValue({ id: 'existing' });
    await make().detectGhosting();
    expect(prismaMock.activity.create).not.toHaveBeenCalled();
    expect(prismaMock.deal.update).toHaveBeenCalled();
  });
});
