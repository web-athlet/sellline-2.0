import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, Role, type User } from '@nextgen/db';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { AppModule } from '../../src/app.module';
import type { AccessTokenPayload } from '../../src/modules/auth/auth.types';
import { PrismaService } from '../../src/prisma/prisma.service';
import { userFactory } from '../factories';

/**
 * Boots the full Nest `AppModule` against the testcontainers Postgres/Redis.
 * Mirrors the production bootstrap in `main.ts` (prefix, URI versioning,
 * ValidationPipe, cookieParser) but omits CSRF — integration tests authenticate
 * with Bearer tokens, which CSRF skips anyway.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ bufferLogs: true });
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.init();
  return app;
}

/**
 * Closes the app, tolerating the one benign teardown error that occurs when a
 * suite never touched Redis: `RedisService` uses a `lazyConnect` client with
 * `enableOfflineQueue: false`, so its `onModuleDestroy` → `client.quit()` throws
 * "Stream isn't writeable" if the client never connected. Any other close error
 * is re-thrown.
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  try {
    await app.close();
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes("Stream isn't writeable")) throw err;
  }
}

/** Signs an access token the `JwtStrategy` will accept for the given user. */
export function signAccessToken(
  app: INestApplication,
  user: Pick<User, 'id' | 'email' | 'role'>,
): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    pwChangedAt: null,
    type: 'access',
  };
  return app.get(JwtService).sign(payload, { expiresIn: '15m' });
}

/**
 * Truncates every application table (FK-safe via CASCADE), keeping the Prisma
 * migration ledger. Call in `beforeEach` for deterministic, isolated tests.
 */
export async function resetDb(prisma: PrismaService): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>(
    Prisma.sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\\_prisma%'`,
  );
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ');
  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
  }
}

/**
 * Flushes the container's Redis. Throttle counters (the per-user GDPR/campaign
 * limits) persist across tests with long TTLs; flush in `beforeEach` of specs
 * that assert on rate limiting to keep them isolated.
 */
export async function flushRedis(): Promise<void> {
  const client = new Redis(process.env.REDIS_URL as string, { maxRetriesPerRequest: 1 });
  try {
    await client.flushdb();
  } finally {
    await client.quit();
  }
}

export interface BaseGraph {
  user: User;
  token: string;
  pipelineId: string;
  stageId: string;
}

/**
 * Seeds the minimal graph most endpoints need: an ADMIN user (so GDPR/RBAC
 * paths are reachable), a default pipeline and a first stage. Returns a signed
 * token for the user.
 */
export async function seedBaseGraph(
  app: INestApplication,
  prisma: PrismaService,
): Promise<BaseGraph> {
  const user = await prisma.user.create({
    data: userFactory.build({ role: Role.ADMIN, passwordChangedAt: null }),
  });
  const pipeline = await prisma.pipeline.create({ data: { name: 'Sales', isDefault: true } });
  const stage = await prisma.stage.create({
    data: { pipelineId: pipeline.id, name: 'Lead', order: 0 },
  });
  return { user, token: signAccessToken(app, user), pipelineId: pipeline.id, stageId: stage.id };
}
