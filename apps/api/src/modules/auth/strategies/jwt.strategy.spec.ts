import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@nextgen/db';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

beforeAll(() => {
  process.env.JWT_SECRET = 'a'.repeat(48);
});

const prismaWithUser = (
  user: {
    id: string;
    email: string;
    role: Role;
    twoFactorEnabled: boolean;
    passwordChangedAt: Date | null;
  } | null,
): PrismaService =>
  ({
    user: { findFirst: vi.fn(async () => user) },
  }) as unknown as PrismaService;

describe('JwtStrategy.validate', () => {
  it('rejects non-access tokens', async () => {
    const strat = new JwtStrategy(prismaWithUser(null));
    await expect(
      strat.validate({
        sub: 'u',
        type: 'pre-2fa' as 'access',
        email: '',
        role: Role.ADMIN,
        pwChangedAt: null,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when user is missing', async () => {
    const strat = new JwtStrategy(prismaWithUser(null));
    await expect(
      strat.validate({
        sub: 'u',
        type: 'access',
        email: 'a@b.c',
        role: Role.ADMIN,
        pwChangedAt: null,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when pwChangedAt diverges from DB', async () => {
    const strat = new JwtStrategy(
      prismaWithUser({
        id: 'u',
        email: 'a@b.c',
        role: Role.ADMIN,
        twoFactorEnabled: false,
        passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    await expect(
      strat.validate({
        sub: 'u',
        type: 'access',
        email: 'a@b.c',
        role: Role.ADMIN,
        pwChangedAt: new Date('2025-01-01T00:00:00.000Z').toISOString(),
      }),
    ).rejects.toThrow(/password change/i);
  });

  it('passes when pwChangedAt matches', async () => {
    const date = new Date('2026-05-09T12:00:00.000Z');
    const strat = new JwtStrategy(
      prismaWithUser({
        id: 'u',
        email: 'a@b.c',
        role: Role.MANAGER,
        twoFactorEnabled: true,
        passwordChangedAt: date,
      }),
    );
    const out = await strat.validate({
      sub: 'u',
      type: 'access',
      email: 'a@b.c',
      role: Role.MANAGER,
      pwChangedAt: date.toISOString(),
    });
    expect(out).toEqual({ id: 'u', email: 'a@b.c', role: Role.MANAGER, twoFactorEnabled: true });
  });

  it('passes when both pwChangedAt are null (fresh account)', async () => {
    const strat = new JwtStrategy(
      prismaWithUser({
        id: 'u',
        email: 'a@b.c',
        role: Role.SALES_REP,
        twoFactorEnabled: false,
        passwordChangedAt: null,
      }),
    );
    const out = await strat.validate({
      sub: 'u',
      type: 'access',
      email: 'a@b.c',
      role: Role.SALES_REP,
      pwChangedAt: null,
    });
    expect(out.id).toBe('u');
  });
});
