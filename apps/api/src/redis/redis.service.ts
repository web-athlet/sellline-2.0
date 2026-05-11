import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    this.client.on('error', (err: Error) => {
      this.logger.warn(`[Redis] connection error: ${err.message}`);
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`[Redis] set failed for key ${key}: ${String(err)}`);
    }
  }

  // KEYS-based pattern delete — acceptable for low-traffic CRM (< 10k keys).
  // Replace with SCAN iteration if key count grows large.
  async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`[Redis] delByPattern failed for ${pattern}: ${String(err)}`);
    }
  }

  onModuleDestroy(): Promise<string> {
    return this.client.quit();
  }
}
