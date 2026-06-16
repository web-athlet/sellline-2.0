import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import type { GlobalSetupContext } from 'vitest/node';

/**
 * Integration-test global setup (Session 16a, Blocks 1 + 4).
 *
 * Spins up a throwaway Postgres (with the pgvector extension, required by
 * `Organization.enrichmentEmbedding vector(1536)`) and a Redis container, applies
 * the Prisma migrations via `migrate deploy` (this is what finally applies the
 * S14 + S15 migrations that were blocked on the invalid local DATABASE_URL —
 * TD#53), and hands the connection strings to the test workers via `provide()`.
 *
 * The container connection strings are passed through `provide`/`inject` because
 * env mutations in global-setup do not reliably reach forked workers; the
 * integration `setup.ts` reads them back into `process.env` before the Nest app
 * boots.
 */
const PG_IMAGE = 'pgvector/pgvector:pg16';
const REDIS_IMAGE = 'redis:7-alpine';
const DB_DIR = resolve(__dirname, '../../../../packages/db');

let pg: StartedTestContainer | undefined;
let redis: StartedTestContainer | undefined;

export default async function setup({ provide }: GlobalSetupContext): Promise<() => Promise<void>> {
  pg = await new GenericContainer(PG_IMAGE)
    .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'testdb' })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();

  redis = await new GenericContainer(REDIS_IMAGE)
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
    .start();

  const databaseUrl = `postgresql://test:test@${pg.getHost()}:${pg.getMappedPort(5432)}/testdb?schema=public`;
  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

  // Apply all migrations to the fresh container (the init migration creates the
  // pgvector extension, hence the pgvector image). Bypasses the `prisma:migrate:deploy`
  // script which would load the empty local .env via dotenv.
  execSync('pnpm exec prisma migrate deploy', {
    cwd: DB_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  provide('databaseUrl', databaseUrl);
  provide('redisUrl', redisUrl);

  return async () => {
    await redis?.stop();
    await pg?.stop();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    redisUrl: string;
  }
}
