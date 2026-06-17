import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from './modules/auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

export interface LivenessResponse {
  status: 'ok';
  uptime: number;
  timestamp: number;
}

export interface ReadinessResponse {
  status: 'ok';
  checks: { database: boolean; redis: boolean };
  timestamp: number;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness — is the process up? Intentionally does NOT touch the DB so a
   * transient database blip can't trigger K8s to restart otherwise-healthy pods.
   */
  @Get()
  check(): LivenessResponse {
    return { status: 'ok', uptime: process.uptime(), timestamp: Date.now() };
  }

  /**
   * Readiness — should this pod receive traffic? The database is hard-required, so
   * a DB failure returns 503 (pod pulled from rotation). Redis is a cache: its
   * status is reported but a Redis outage alone does NOT fail readiness, matching
   * the app's graceful cache degradation.
   */
  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.redis.ping()]);
    const checks = { database, redis };
    if (!database) {
      throw new ServiceUnavailableException({ status: 'error', checks, timestamp: Date.now() });
    }
    return { status: 'ok', checks, timestamp: Date.now() };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
