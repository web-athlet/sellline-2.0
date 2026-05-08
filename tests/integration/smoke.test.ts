import { describe, expect, it } from 'vitest';

// Placeholder integration test — keeps `pnpm test:integration` exit-0 for the quality-gate.
// Session 1 will replace this with testcontainers + Postgres/Redis smoke checks.
describe('integration smoke', () => {
  it('environment math works', () => {
    expect(1 + 1).toBe(2);
  });
});
