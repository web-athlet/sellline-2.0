import { EventsGateway } from '../../events/events.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringService } from './scoring.service';

const makeLead = (overrides = {}) => ({
  id: 'lead-1',
  companyName: 'Acme GmbH',
  emailDomain: 'acme.de',
  dataJson: { email: 'max@acme.de', phone: '+49 30 1234' },
  enrichedJson: { fields: { branche: 'SaaS', mitarbeiterzahl: 120, jahresumsatz: 5_000_000 } },
  convertedDealId: null,
  updatedAt: new Date(),
  deletedAt: null,
  ...overrides,
});

// Person with strong campaign engagement → pushes the strong lead over 80.
const engagedPerson = {
  campaignContacts: [
    ...Array(5).fill({ openedAt: new Date(), clickedAt: null }),
    ...Array(2).fill({ openedAt: null, clickedAt: new Date() }),
  ],
};

const txMock = {
  person: { create: vi.fn() },
  deal: { create: vi.fn() },
  activity: { create: vi.fn() },
  lead: { update: vi.fn() },
};
const prismaMock = {
  lead: { findFirst: vi.fn(), update: vi.fn() },
  person: { findFirst: vi.fn() },
  aIInsight: { create: vi.fn() },
  pipeline: { findFirst: vi.fn() },
  stage: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: typeof txMock) => unknown) => cb(txMock)),
};
const eventsMock = { emitDealCreated: vi.fn() };
const queueMock = { add: vi.fn(), remove: vi.fn() };

const make = () =>
  new ScoringService(
    prismaMock as unknown as PrismaService,
    eventsMock as unknown as EventsGateway,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queueMock as any,
  );

describe('ScoringService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_AUTO_CONVERT_ENABLED;
    queueMock.remove.mockResolvedValue(undefined);
    queueMock.add.mockResolvedValue({});
    prismaMock.lead.update.mockResolvedValue({});
    prismaMock.aIInsight.create.mockResolvedValue({});
    prismaMock.person.findFirst.mockResolvedValue(null);
    prismaMock.pipeline.findFirst.mockResolvedValue({ id: 'p1' });
    prismaMock.stage.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1' });
    txMock.person.create.mockResolvedValue({ id: 'pe1' });
    txMock.deal.create.mockResolvedValue({ id: 'd1' });
    txMock.activity.create.mockResolvedValue({});
    txMock.lead.update.mockResolvedValue({});
  });

  afterEach(() => {
    delete process.env.AI_AUTO_CONVERT_ENABLED;
  });

  it('debounces enqueue: removes the pending job then re-adds with a 30s delay (AC-026)', async () => {
    await make().enqueue('lead-1');
    expect(queueMock.remove).toHaveBeenCalledWith('score-lead-1');
    expect(queueMock.add).toHaveBeenCalledWith(
      'score',
      { leadId: 'lead-1' },
      expect.objectContaining({ delay: 30_000, jobId: 'score-lead-1' }),
    );
  });

  it('persists score + scoreUpdatedAt and writes a scoring insight', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    await make().score('lead-1');
    expect(prismaMock.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({
          score: expect.any(Number),
          scoreUpdatedAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.aIInsight.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'scoring' }) }),
    );
  });

  it('auto-converts a lead scoring ≥80 when enabled', async () => {
    process.env.AI_AUTO_CONVERT_ENABLED = 'true';
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    prismaMock.person.findFirst.mockResolvedValue(engagedPerson);

    await make().score('lead-1');

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(txMock.deal.create).toHaveBeenCalled();
    expect(txMock.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subject: expect.stringContaining('Auto-konvertiert') }),
      }),
    );
    expect(eventsMock.emitDealCreated).toHaveBeenCalledWith(
      expect.objectContaining({ dealId: 'd1', pipelineId: 'p1', stageId: 's1', userId: 'u1' }),
    );
  });

  it('does not auto-convert when disabled, even at a high score', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    prismaMock.person.findFirst.mockResolvedValue(engagedPerson);
    await make().score('lead-1');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(eventsMock.emitDealCreated).not.toHaveBeenCalled();
  });

  it('skips auto-convert when no owner can be resolved', async () => {
    process.env.AI_AUTO_CONVERT_ENABLED = 'true';
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    prismaMock.person.findFirst.mockResolvedValue(engagedPerson);
    prismaMock.user.findFirst.mockResolvedValue(null); // no ADMIN/MANAGER

    await make().score('lead-1');

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(eventsMock.emitDealCreated).not.toHaveBeenCalled();
  });

  it('resolves the configured default owner by email when set', async () => {
    process.env.AI_AUTO_CONVERT_ENABLED = 'true';
    process.env.AI_DEFAULT_OWNER_EMAIL = 'ai@demo.de';
    prismaMock.lead.findFirst.mockResolvedValue(makeLead());
    prismaMock.person.findFirst.mockResolvedValue(engagedPerson);

    await make().score('lead-1');

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ email: 'ai@demo.de' }) }),
    );
    delete process.env.AI_DEFAULT_OWNER_EMAIL;
  });

  it('scores a lead with no email without querying engagement', async () => {
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ dataJson: {}, emailDomain: null }));
    await make().score('lead-1');
    expect(prismaMock.person.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.lead.update).toHaveBeenCalled();
  });

  it('is idempotent: never re-converts an already-converted lead', async () => {
    process.env.AI_AUTO_CONVERT_ENABLED = 'true';
    prismaMock.lead.findFirst.mockResolvedValue(makeLead({ convertedDealId: 'deal-existing' }));
    prismaMock.person.findFirst.mockResolvedValue(engagedPerson);
    await make().score('lead-1');
    expect(prismaMock.pipeline.findFirst).not.toHaveBeenCalled();
    expect(eventsMock.emitDealCreated).not.toHaveBeenCalled();
  });
});
