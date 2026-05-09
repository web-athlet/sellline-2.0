import { describe, expect, it } from 'vitest';
import { DB_PACKAGE_VERSION, getPrisma, PrismaClient } from './index';

describe('@nextgen/db exports', () => {
  it('exposes a semver-shaped package version', () => {
    expect(DB_PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('re-exports the PrismaClient class', () => {
    expect(typeof PrismaClient).toBe('function');
  });

  it('returns the same instance from getPrisma() across calls', () => {
    const a = getPrisma();
    const b = getPrisma();
    expect(a).toBe(b);
  });
});
