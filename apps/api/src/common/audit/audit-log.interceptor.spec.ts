import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogInterceptor } from './audit-log.interceptor';

const flush = () => new Promise((r) => setImmediate(r));

const prismaMock = { auditLog: { create: vi.fn() } };

const ctxFor = (req: Record<string, unknown>): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const handlerFor = (resp: unknown): CallHandler => ({ handle: () => of(resp) });

const baseReq = (over: Record<string, unknown> = {}) => ({
  method: 'POST',
  route: { path: '/api/v1/deals' },
  params: {},
  body: {},
  headers: { 'user-agent': 'vitest' },
  ip: '127.0.0.1',
  user: { id: 'u1' },
  ...over,
});

const make = () => new AuditLogInterceptor(prismaMock as unknown as PrismaService);

describe('AuditLogInterceptor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.auditLog.create.mockResolvedValue({});
  });

  it('writes an audit row for a mutating request with redacted payload', async () => {
    const req = baseReq({ body: { title: 'A', password: 'secret' } });
    await new Promise<void>((resolve) => {
      make()
        .intercept(ctxFor(req), handlerFor({ id: 'd1', title: 'A' }))
        .subscribe(() => resolve());
    });
    await flush();
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const data = prismaMock.auditLog.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      userId: 'u1',
      action: 'POST /api/v1/deals',
      tableName: 'deals',
      recordId: 'd1',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(data.changes.payload.password).toBe('[REDACTED]');
    expect(data.changes.after).toMatchObject({ id: 'd1' });
  });

  it('uses params.id as recordId when present', async () => {
    const req = baseReq({
      method: 'PATCH',
      params: { id: 'd9' },
      route: { path: '/api/v1/deals/:id' },
    });
    await new Promise<void>((resolve) => {
      make()
        .intercept(ctxFor(req), handlerFor({}))
        .subscribe(() => resolve());
    });
    await flush();
    expect(prismaMock.auditLog.create.mock.calls[0]![0].data.recordId).toBe('d9');
  });

  it('skips GET requests', async () => {
    const req = baseReq({ method: 'GET' });
    await new Promise<void>((resolve) => {
      make()
        .intercept(ctxFor(req), handlerFor({}))
        .subscribe(() => resolve());
    });
    await flush();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('skips auth routes to avoid logging credentials', async () => {
    const req = baseReq({ route: { path: '/api/v1/auth/login' } });
    await new Promise<void>((resolve) => {
      make()
        .intercept(ctxFor(req), handlerFor({}))
        .subscribe(() => resolve());
    });
    await flush();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('never breaks the response when the audit write fails', async () => {
    prismaMock.auditLog.create.mockRejectedValue(new Error('db down'));
    const seen: unknown[] = [];
    await new Promise<void>((resolve) => {
      make()
        .intercept(ctxFor(baseReq()), handlerFor({ id: 'd1' }))
        .subscribe((v) => {
          seen.push(v);
          resolve();
        });
    });
    await flush();
    expect(seen).toEqual([{ id: 'd1' }]);
  });
});
