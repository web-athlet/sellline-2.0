import 'reflect-metadata';
import { inject } from 'vitest';

/**
 * Per-worker integration setup. Reads the container connection strings provided
 * by `global-setup.ts` into `process.env` before any Nest module (PrismaClient,
 * BullMQ, throttler) reads them, and supplies the static secrets the app
 * requires at construction (`JWT_SECRET`, `ENCRYPTION_KEY`).
 */
process.env.DATABASE_URL = inject('databaseUrl');
process.env.REDIS_URL = inject('redisUrl');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'integration-test-jwt-secret-which-is-long-enough-32+';
// 64 lowercase hex chars (= 32 bytes) — required by EncryptionService.
process.env.ENCRYPTION_KEY ??= '00000000000000000000000000000000000000000000000000000000deadbeef';
