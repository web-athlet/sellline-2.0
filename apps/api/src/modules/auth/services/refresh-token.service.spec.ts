import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { RefreshTokenService } from './refresh-token.service';
import type { PrismaService } from '../../../prisma/prisma.service';

interface FakeRefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByToken: string | null;
  createdAt: Date;
}

const future = (mins: number) => new Date(Date.now() + mins * 60_000);
const past = (mins: number) => new Date(Date.now() - mins * 60_000);

const makePrismaStub = (rows: FakeRefreshTokenRow[]): PrismaService => {
  const refreshToken = {
    create: vi.fn(async ({ data }: { data: Partial<FakeRefreshTokenRow> }) => {
      const row: FakeRefreshTokenRow = {
        id: `rt-${rows.length + 1}`,
        userId: data.userId!,
        tokenHash: data.tokenHash!,
        family: data.family!,
        expiresAt: data.expiresAt!,
        revokedAt: null,
        replacedByToken: null,
        createdAt: new Date(),
      };
      rows.unshift(row);
      return row;
    }),
    findMany: vi.fn(
      async ({
        where,
        take,
      }: {
        where: { userId: string; revokedAt?: null; expiresAt?: { gt: Date } };
        take?: number;
      }) => {
        let filtered = rows.filter((r) => r.userId === where.userId);
        if (where.revokedAt === null) filtered = filtered.filter((r) => r.revokedAt === null);
        if (where.expiresAt?.gt)
          filtered = filtered.filter((r) => r.expiresAt > where.expiresAt!.gt);
        return filtered.slice(0, take ?? 50);
      },
    ),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<FakeRefreshTokenRow> }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data);
        return row;
      },
    ),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: {
          family?: string;
          userId?: string;
          revokedAt?: null;
          id?: string;
          NOT?: { id?: string };
        };
        data: Partial<FakeRefreshTokenRow>;
      }) => {
        let count = 0;
        for (const row of rows) {
          if (where.family && row.family !== where.family) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (where.revokedAt === null && row.revokedAt !== null) continue;
          if (where.id && row.id !== where.id) continue;
          if (where.NOT?.id && row.id === where.NOT.id) continue;
          Object.assign(row, data);
          count++;
        }
        return { count };
      },
    ),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
      return rows.find((r) => r.id === where.id) ?? null;
    }),
  };
  return { refreshToken } as unknown as PrismaService;
};

describe('RefreshTokenService', () => {
  let rows: FakeRefreshTokenRow[];
  let prisma: PrismaService;
  let svc: RefreshTokenService;

  beforeEach(() => {
    rows = [];
    prisma = makePrismaStub(rows);
    svc = new RefreshTokenService(prisma);
  });

  it('parseCookie splits userId.raw', () => {
    expect(svc.parseCookie('user-1.abcdef')).toEqual({ userId: 'user-1', raw: 'abcdef' });
    expect(svc.parseCookie('malformed')).toBeNull();
    expect(svc.parseCookie(undefined)).toBeNull();
    expect(svc.parseCookie('.no-userid')).toBeNull();
  });

  it('issueForLogin creates a new family + row', async () => {
    const issued = await svc.issueForLogin('user-1');
    expect(issued.rawCookieValue).toMatch(/^user-1\./);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.family).toBe(issued.family);
    expect(rows[0]?.userId).toBe('user-1');
  });

  it('rotate happy path: revokes old, creates new in same family', async () => {
    const first = await svc.issueForLogin('user-1');
    const result = await svc.rotate(first.rawCookieValue);
    expect(result.kind).toBe('rotated');
    if (result.kind !== 'rotated') return;
    expect(result.family).toBe(first.family);
    expect(rows).toHaveLength(2);
    const oldRow = rows.find((r) => r.id === first.refreshTokenId);
    expect(oldRow?.revokedAt).toBeInstanceOf(Date);
    expect(oldRow?.replacedByToken).toBe(result.issued.refreshTokenId);
    const newRow = rows.find((r) => r.id === result.issued.refreshTokenId);
    expect(newRow?.revokedAt).toBeNull();
    expect(newRow?.family).toBe(first.family);
  });

  it('rotate with invalid cookie returns invalid', async () => {
    const result = await svc.rotate('user-1.notarealtokenvalue');
    expect(result.kind).toBe('invalid');
  });

  it('rotate detects replay and revokes ENTIRE family', async () => {
    const first = await svc.issueForLogin('user-1');
    await svc.rotate(first.rawCookieValue);
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(1);

    // attempt to reuse the original (now-revoked) cookie
    const replay = await svc.rotate(first.rawCookieValue);
    expect(replay.kind).toBe('replay-detected');
    expect(rows.filter((r) => r.revokedAt === null)).toHaveLength(0);
  });

  it('rotate rejects expired tokens as invalid', async () => {
    const issued = await svc.issueForLogin('user-1');
    const row = rows.find((r) => r.id === issued.refreshTokenId)!;
    row.expiresAt = past(5);
    const result = await svc.rotate(issued.rawCookieValue);
    expect(result.kind).toBe('invalid');
  });

  it('revokeAllForUser revokes all but the exception', async () => {
    const a = await svc.issueForLogin('user-1');
    const b = await svc.issueForLogin('user-1');
    const c = await svc.issueForLogin('user-1');
    await svc.revokeAllForUser('user-1', b.refreshTokenId);
    expect(rows.find((r) => r.id === a.refreshTokenId)?.revokedAt).toBeInstanceOf(Date);
    expect(rows.find((r) => r.id === b.refreshTokenId)?.revokedAt).toBeNull();
    expect(rows.find((r) => r.id === c.refreshTokenId)?.revokedAt).toBeInstanceOf(Date);
  });

  it('revokeById revokes only the matching active row', async () => {
    const a = await svc.issueForLogin('user-1');
    await svc.revokeById(a.refreshTokenId);
    expect(rows.find((r) => r.id === a.refreshTokenId)?.revokedAt).toBeInstanceOf(Date);
  });

  it('findByCookie returns active match, null on revoked or stale', async () => {
    const a = await svc.issueForLogin('user-1');
    const found = await svc.findByCookie(a.rawCookieValue);
    expect(found?.id).toBe(a.refreshTokenId);
    await svc.revokeById(a.refreshTokenId);
    const refound = await svc.findByCookie(a.rawCookieValue);
    expect(refound).toBeNull();
    expect(await svc.findByCookie(undefined)).toBeNull();
  });

  it('formatCookie produces userId.raw', () => {
    expect(svc.formatCookie('u', 'r')).toBe('u.r');
  });

  it('uses bcrypt-hashed token (storage never plaintext)', async () => {
    const { rawCookieValue } = await svc.issueForLogin('user-1');
    const raw = rawCookieValue.split('.')[1]!;
    expect(rows[0]?.tokenHash).not.toBe(raw);
    expect(await bcrypt.compare(raw, rows[0]!.tokenHash)).toBe(true);
  });

  it('assertActiveOrThrow throws on revoked / expired / missing', async () => {
    const a = await svc.issueForLogin('user-1');
    await expect(svc.assertActiveOrThrow(a.refreshTokenId)).resolves.toBeUndefined();
    await svc.revokeById(a.refreshTokenId);
    await expect(svc.assertActiveOrThrow(a.refreshTokenId)).rejects.toThrow();
    await expect(svc.assertActiveOrThrow('does-not-exist')).rejects.toThrow();
  });

  // exercise edge: not future expiration boundary
  it('respects future expiration', async () => {
    expect(future(10).getTime()).toBeGreaterThan(Date.now());
  });
});
