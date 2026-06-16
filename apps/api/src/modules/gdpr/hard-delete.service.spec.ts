import { PrismaService } from '../../prisma/prisma.service';
import { HardDeleteService } from './hard-delete.service';

const prismaMock = {
  person: { findMany: vi.fn(), deleteMany: vi.fn() },
  lead: { findMany: vi.fn(), deleteMany: vi.fn() },
  activity: { updateMany: vi.fn() },
  auditLog: { createMany: vi.fn() },
  $transaction: vi.fn(),
};
const make = () => new HardDeleteService(prismaMock as unknown as PrismaService);

describe('HardDeleteService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.GDPR_HARD_DELETE_ENABLED;
    delete process.env.GDPR_HARD_DELETE_GRACE_DAYS;
    prismaMock.person.findMany.mockResolvedValue([]);
    prismaMock.lead.findMany.mockResolvedValue([]);
    prismaMock.auditLog.createMany.mockResolvedValue({ count: 0 });
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.$transaction.mockResolvedValue([]);
  });

  it('is a no-op when the feature flag is off', async () => {
    prismaMock.person.findMany.mockResolvedValue([{ id: 'p1', deletedAt: new Date() }]);
    const res = await make().run();
    expect(res).toEqual({ persons: 0, leads: 0 });
    expect(prismaMock.person.findMany).not.toHaveBeenCalled();
  });

  it('audits before deleting and unlinks activities before deleting persons', async () => {
    process.env.GDPR_HARD_DELETE_ENABLED = 'true';
    prismaMock.person.findMany.mockResolvedValue([{ id: 'p1', deletedAt: new Date('2026-01-01') }]);
    const res = await make().run();

    expect(res.persons).toBe(1);
    expect(prismaMock.auditLog.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ action: 'HARD_DELETE', tableName: 'Person', recordId: 'p1' }),
      ],
    });
    // audit happens before the destructive transaction
    expect(prismaMock.auditLog.createMany.mock.invocationCallOrder[0]!).toBeLessThan(
      prismaMock.$transaction.mock.invocationCallOrder[0]!,
    );
    // transaction ordering: activity unlink first, then person delete
    expect(prismaMock.activity.updateMany).toHaveBeenCalledWith({
      where: { personId: { in: ['p1'] } },
      data: { personId: null },
    });
    expect(prismaMock.person.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['p1'] } } });
  });

  it('purges eligible leads', async () => {
    process.env.GDPR_HARD_DELETE_ENABLED = 'true';
    prismaMock.lead.findMany.mockResolvedValue([{ id: 'l1', deletedAt: new Date('2026-01-01') }]);
    prismaMock.lead.deleteMany.mockResolvedValue({ count: 1 });
    const res = await make().run();
    expect(res.leads).toBe(1);
    expect(prismaMock.lead.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['l1'] } } });
  });

  it('does nothing destructive when no records are eligible', async () => {
    process.env.GDPR_HARD_DELETE_ENABLED = 'true';
    const res = await make().run();
    expect(res).toEqual({ persons: 0, leads: 0 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.lead.deleteMany).not.toHaveBeenCalled();
  });

  it('runs via the cron wrapper', async () => {
    await expect(make().hardDeleteCron()).resolves.toBeUndefined();
  });
});
