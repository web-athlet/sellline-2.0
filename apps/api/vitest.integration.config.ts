import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Integration-test config (Session 16a). Boots the full Nest app against
 * testcontainers Postgres/Redis. Kept separate from the unit `vitest.config.ts`
 * so unit runs stay fast and DB-free.
 *
 * Runs single-fork / non-parallel because all specs share one database that is
 * truncated between tests; container startup happens once in `global-setup.ts`.
 */
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.int-spec.ts'],
    setupFiles: ['./test/integration/setup.ts'],
    globalSetup: './test/integration/global-setup.ts',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    // Container start + migrations + per-suite app bootstrap are slow.
    testTimeout: 30_000,
    hookTimeout: 180_000,
  },
});
