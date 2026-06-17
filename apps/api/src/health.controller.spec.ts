import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import type { PrismaService } from './prisma/prisma.service';
import type { RedisService } from './redis/redis.service';

function makeController(opts: { dbOk: boolean; redisOk: boolean }) {
  const prisma = {
    $queryRaw: opts.dbOk
      ? vi.fn().mockResolvedValue([{ '?column?': 1 }])
      : vi.fn().mockRejectedValue(new Error('db down')),
  } as unknown as PrismaService;
  const redis = {
    ping: vi.fn().mockResolvedValue(opts.redisOk),
  } as unknown as RedisService;
  return { controller: new HealthController(prisma, redis), prisma, redis };
}

describe('HealthController', () => {
  describe('liveness', () => {
    const { controller } = makeController({ dbOk: true, redisOk: true });

    it('returns status ok', () => {
      expect(controller.check().status).toBe('ok');
    });

    it('returns a numeric uptime', () => {
      const result = controller.check();
      expect(typeof result.uptime).toBe('number');
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns a recent timestamp', () => {
      const before = Date.now();
      const result = controller.check();
      const after = Date.now();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('readiness', () => {
    it('returns ok when database and redis are healthy', async () => {
      const { controller } = makeController({ dbOk: true, redisOk: true });
      const res = await controller.ready();
      expect(res).toMatchObject({ status: 'ok', checks: { database: true, redis: true } });
    });

    it('stays ready (degraded) when only redis is down', async () => {
      const { controller } = makeController({ dbOk: true, redisOk: false });
      const res = await controller.ready();
      expect(res.status).toBe('ok');
      expect(res.checks).toEqual({ database: true, redis: false });
    });

    it('throws 503 when the database is unreachable', async () => {
      const { controller } = makeController({ dbOk: false, redisOk: true });
      await expect(controller.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
