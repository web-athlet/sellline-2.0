import { MailService } from '../../mail/mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CostService } from './cost.service';

const prismaMock = {
  aIInsight: { findMany: vi.fn(), create: vi.fn() },
};
const mailMock = { sendCampaignEmail: vi.fn() };
const queueMock = { isPaused: vi.fn(), pause: vi.fn(), resume: vi.fn() };

const make = () =>
  new CostService(
    prismaMock as unknown as PrismaService,
    mailMock as unknown as MailService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queueMock as any,
  );

const spend = (estCostUsd: number) =>
  prismaMock.aIInsight.findMany.mockResolvedValue([{ content: { cost: { estCostUsd } } }]);

describe('CostService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_MONTHLY_BUDGET_USD = '100';
    delete process.env.AI_ALERT_EMAIL;
    prismaMock.aIInsight.create.mockResolvedValue({});
    mailMock.sendCampaignEmail.mockResolvedValue(undefined);
    queueMock.isPaused.mockResolvedValue(false);
    queueMock.pause.mockResolvedValue(undefined);
    queueMock.resume.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.AI_MONTHLY_BUDGET_USD;
  });

  it('does nothing under 90% of budget', async () => {
    spend(10);
    const res = await make().checkBudget();
    expect(res.action).toBe('ok');
    expect(queueMock.pause).not.toHaveBeenCalled();
    expect(prismaMock.aIInsight.create).not.toHaveBeenCalled();
  });

  it('warns at ≥90% without pausing (AC-Budget)', async () => {
    spend(95);
    const res = await make().checkBudget();
    expect(res.action).toBe('warn');
    expect(queueMock.pause).not.toHaveBeenCalled();
    expect(prismaMock.aIInsight.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'budget_alert' }) }),
    );
  });

  it('pauses the enrichment queue at ≥100%', async () => {
    spend(120);
    const res = await make().checkBudget();
    expect(res.action).toBe('paused');
    expect(queueMock.pause).toHaveBeenCalled();
  });

  it('auto-resumes when back under budget and currently paused', async () => {
    spend(10);
    queueMock.isPaused.mockResolvedValue(true);
    const res = await make().checkBudget();
    expect(res.action).toBe('resumed');
    expect(queueMock.resume).toHaveBeenCalled();
  });

  it('emails the admin alert recipient when configured', async () => {
    process.env.AI_ALERT_EMAIL = 'ops@demo.de';
    spend(120);
    await make().checkBudget();
    expect(mailMock.sendCampaignEmail).toHaveBeenCalledWith(
      'ops@demo.de',
      expect.stringContaining('Budget'),
      expect.any(String),
    );
    delete process.env.AI_ALERT_EMAIL;
  });

  it('runs via the daily cron wrapper', async () => {
    spend(10);
    await expect(make().dailyBudgetCheck()).resolves.toBeUndefined();
  });

  it('treats insights without a cost record as zero spend', async () => {
    prismaMock.aIInsight.findMany.mockResolvedValue([{ content: {} }, { content: null }]);
    const res = await make().checkBudget();
    expect(res.spent).toBe(0);
    expect(res.action).toBe('ok');
  });
});
