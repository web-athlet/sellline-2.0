import { PrismaService } from '../../prisma/prisma.service';
import { AuditRetentionService } from './audit-retention.service';

const prismaMock = { auditLog: { deleteMany: vi.fn() } };
const make = () => new AuditRetentionService(prismaMock as unknown as PrismaService);

describe('AuditRetentionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AUDIT_RETENTION_YEARS;
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('deletes audit logs older than the default 7 years', async () => {
    const now = new Date('2026-06-16T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    await make().purgeExpired();
    vi.useRealTimers();
    const where = prismaMock.auditLog.deleteMany.mock.calls[0]![0].where;
    expect(where.createdAt.lt.getUTCFullYear()).toBe(2019);
  });

  it('honours AUDIT_RETENTION_YEARS override', async () => {
    process.env.AUDIT_RETENTION_YEARS = '1';
    const now = new Date('2026-06-16T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    await make().purgeExpired();
    vi.useRealTimers();
    const where = prismaMock.auditLog.deleteMany.mock.calls[0]![0].where;
    expect(where.createdAt.lt.getUTCFullYear()).toBe(2025);
  });

  it('returns the deleted count', async () => {
    prismaMock.auditLog.deleteMany.mockResolvedValue({ count: 42 });
    await expect(make().purgeExpired()).resolves.toBe(42);
  });

  it('runs via the cron wrapper', async () => {
    await expect(make().purgeExpiredCron()).resolves.toBeUndefined();
  });
});
