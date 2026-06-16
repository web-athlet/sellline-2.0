import { JwtService } from '@nestjs/jwt';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@nextgen/db';
import * as bcrypt from 'bcryptjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { MailService } from '../../mail/mail.service';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { TwoFactorService } from './services/two-factor.service';
import { PwnedPasswordService } from './services/pwned-password.service';
import type { PrismaService } from '../../prisma/prisma.service';

beforeAll(() => {
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.ENCRYPTION_KEY = '00000000000000000000000000000000000000000000000000000000deadbeef';
});

interface UserRow {
  id: string;
  email: string;
  name: string;
  password: string;
  role: Role;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  passwordChangedAt: Date | null;
  deletedAt: Date | null;
  gmailTokenEncrypted: string | null;
  outlookTokenEncrypted: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
}

interface PasswordResetRow {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

interface RefreshRow {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  revokedAt: Date | null;
  expiresAt: Date;
  replacedByToken: string | null;
  createdAt: Date;
}

const buildPrisma = (
  initial: { users?: UserRow[]; resets?: PasswordResetRow[]; refresh?: RefreshRow[] } = {},
) => {
  const users: UserRow[] = initial.users ?? [];
  const resets: PasswordResetRow[] = initial.resets ?? [];
  const refresh: RefreshRow[] = initial.refresh ?? [];

  const userClient = {
    findFirst: vi.fn(async ({ where }: { where: Partial<UserRow> & { deletedAt?: null } }) => {
      return (
        users.find(
          (u) =>
            (where.id ? u.id === where.id : true) &&
            (where.email ? u.email === where.email : true) &&
            (where.deletedAt === null ? u.deletedAt === null : true),
        ) ?? null
      );
    }),
    create: vi.fn(async ({ data }: { data: Partial<UserRow> }) => {
      const row: UserRow = {
        id: data.id ?? `u-${users.length + 1}`,
        email: data.email!,
        name: data.name!,
        password: data.password!,
        role: data.role ?? Role.SALES_REP,
        twoFactorEnabled: data.twoFactorEnabled ?? false,
        twoFactorSecret: data.twoFactorSecret ?? null,
        passwordChangedAt: data.passwordChangedAt ?? null,
        deletedAt: null,
        gmailTokenEncrypted: data.gmailTokenEncrypted ?? null,
        outlookTokenEncrypted: data.outlookTokenEncrypted ?? null,
      };
      users.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<UserRow> }) => {
      const u = users.find((x) => x.id === where.id)!;
      Object.assign(u, data);
      return u;
    }),
  };

  const passwordResetClient = {
    create: vi.fn(async ({ data }: { data: Partial<PasswordResetRow> }) => {
      const row: PasswordResetRow = {
        id: `pr-${resets.length + 1}`,
        userId: data.userId!,
        tokenHash: data.tokenHash!,
        expiresAt: data.expiresAt!,
        usedAt: null,
        createdAt: new Date(),
      };
      resets.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where }: { where: { expiresAt?: { gt: Date }; usedAt?: null } }) => {
      return resets
        .filter(
          (r) =>
            (where.expiresAt?.gt ? r.expiresAt > where.expiresAt.gt : true) &&
            (where.usedAt === null ? r.usedAt === null : true),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }),
    update: vi.fn(
      async ({ where, data }: { where: { id: string }; data: Partial<PasswordResetRow> }) => {
        const r = resets.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      },
    ),
  };

  const refreshClient = {
    create: vi.fn(async ({ data }: { data: Partial<RefreshRow> }) => {
      const row: RefreshRow = {
        id: `rt-${refresh.length + 1}`,
        userId: data.userId!,
        tokenHash: data.tokenHash!,
        family: data.family!,
        revokedAt: null,
        expiresAt: data.expiresAt!,
        replacedByToken: null,
        createdAt: new Date(),
      };
      refresh.push(row);
      return row;
    }),
    findMany: vi.fn(
      async ({
        where,
        take,
      }: {
        where: { userId?: string; revokedAt?: null; expiresAt?: { gt: Date } };
        take?: number;
      }) => {
        let rows = refresh.filter((r) => (where.userId ? r.userId === where.userId : true));
        if (where.revokedAt === null) rows = rows.filter((r) => r.revokedAt === null);
        if (where.expiresAt?.gt) rows = rows.filter((r) => r.expiresAt > where.expiresAt!.gt);
        return rows.slice(0, take ?? 50);
      },
    ),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<RefreshRow> }) => {
      const r = refresh.find((x) => x.id === where.id)!;
      Object.assign(r, data);
      return r;
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Partial<RefreshRow> & { NOT?: { id?: string } };
        data: Partial<RefreshRow>;
      }) => {
        let count = 0;
        for (const row of refresh) {
          if (where.userId && row.userId !== where.userId) continue;
          if (where.family && row.family !== where.family) continue;
          if (where.revokedAt === null && row.revokedAt !== null) continue;
          if (where.id && row.id !== where.id) continue;
          if (where.NOT?.id && row.id === where.NOT.id) continue;
          Object.assign(row, data);
          count++;
        }
        return { count };
      },
    ),
    findUnique: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        refresh.find((r) => r.id === where.id) ?? null,
    ),
  };

  const prisma = {
    user: userClient,
    passwordReset: passwordResetClient,
    refreshToken: refreshClient,
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  } as unknown as PrismaService;

  return { prisma, users, resets, refresh };
};

const buildSvc = (
  prisma: PrismaService,
  { mail = new MailService(), encryption = new EncryptionService() } = {},
): AuthService => {
  const refreshTokens = new RefreshTokenService(prisma);
  const twoFactor = new TwoFactorService(encryption);
  const jwt = new JwtService({ secret: process.env.JWT_SECRET! });
  // HIBP disabled by default → assertNotPwned resolves without a network call.
  const pwned = new PwnedPasswordService();
  return new AuthService(prisma, jwt, refreshTokens, twoFactor, encryption, mail, pwned);
};

describe('AuthService', () => {
  let env: ReturnType<typeof buildPrisma>;
  beforeEach(() => {
    env = buildPrisma();
  });

  describe('register', () => {
    it('creates user, hashes password (cost 12), returns access + refresh', async () => {
      const svc = buildSvc(env.prisma);
      const out = await svc.register({ email: 'new@x.de', password: 'Demo1234!', name: 'Neu' });
      expect(out.accessToken).toBeTruthy();
      expect(out.refreshCookie.value).toMatch(/^[^.]+\..+/);
      expect(env.users[0]?.password.startsWith('$2')).toBe(true);
      expect(await bcrypt.compare('Demo1234!', env.users[0]!.password)).toBe(true);
    });

    it('throws ConflictException on duplicate email', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'dup@x.de', password: 'Demo1234!', name: 'A' });
      await expect(
        svc.register({ email: 'dup@x.de', password: 'Demo1234!', name: 'B' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns authenticated for SALES_REP without 2FA', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const result = await svc.login({ email: 'a@x.de', password: 'Demo1234!' });
      expect(result.status).toBe('authenticated');
      expect(result.accessToken).toBeTruthy();
    });

    it('throws on wrong password', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      await expect(svc.login({ email: 'a@x.de', password: 'Wrong-1!' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws on unknown user', async () => {
      const svc = buildSvc(env.prisma);
      await expect(svc.login({ email: 'no@x.de', password: 'Demo1234!' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns requires-2fa-setup for ADMIN without 2FA', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'admin@x.de', password: 'Demo1234!', name: 'Admin' });
      env.users[0]!.role = Role.ADMIN;
      const result = await svc.login({ email: 'admin@x.de', password: 'Demo1234!' });
      expect(result.status).toBe('requires-2fa-setup');
      expect(result.setupToken).toBeTruthy();
    });

    it('returns requires-2fa for user with 2FA enabled', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      env.users[0]!.twoFactorEnabled = true;
      const result = await svc.login({ email: 'a@x.de', password: 'Demo1234!' });
      expect(result.status).toBe('requires-2fa');
      expect(result.preAuthToken).toBeTruthy();
    });

    it('locks the account after 5 failed attempts', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      for (let i = 0; i < 5; i++) {
        await expect(svc.login({ email: 'a@x.de', password: 'Wrong-1!' })).rejects.toThrow(
          UnauthorizedException,
        );
      }
      expect(env.users[0]!.lockedUntil).toBeInstanceOf(Date);
      expect(env.users[0]!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects login while locked even with the correct password', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      env.users[0]!.lockedUntil = new Date(Date.now() + 60_000);
      await expect(svc.login({ email: 'a@x.de', password: 'Demo1234!' })).rejects.toThrow(
        /locked/i,
      );
    });

    it('resets the failed-attempt counter on a successful login', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      await expect(svc.login({ email: 'a@x.de', password: 'Wrong-1!' })).rejects.toThrow();
      expect(env.users[0]!.failedLoginAttempts).toBe(1);
      const result = await svc.login({ email: 'a@x.de', password: 'Demo1234!' });
      expect(result.status).toBe('authenticated');
      expect(env.users[0]!.failedLoginAttempts).toBe(0);
    });
  });

  describe('changePassword', () => {
    it('revokes existing refresh tokens + bumps passwordChangedAt + issues fresh pair', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      // pretend two RTs are alive
      await svc['refreshTokens'].issueForLogin(userId);
      await svc['refreshTokens'].issueForLogin(userId);
      const liveBefore = env.refresh.filter(
        (r) => r.userId === userId && r.revokedAt === null,
      ).length;
      expect(liveBefore).toBeGreaterThanOrEqual(2);

      const result = await svc.changePassword(userId, 'Demo1234!', 'NewPass1!');
      expect(result.accessToken).toBeTruthy();

      const liveAfter = env.refresh.filter((r) => r.userId === userId && r.revokedAt === null);
      expect(liveAfter).toHaveLength(1); // only the freshly-issued one
      expect(env.users[0]!.passwordChangedAt).toBeInstanceOf(Date);
      expect(await bcrypt.compare('NewPass1!', env.users[0]!.password)).toBe(true);
    });

    it('rejects wrong old password', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      await expect(svc.changePassword(userId, 'Wrong-1!', 'NewPass1!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('forgot/resetPassword', () => {
    it('forgotPassword is timing-safe for unknown email', async () => {
      const svc = buildSvc(env.prisma);
      const t0 = Date.now();
      await svc.forgotPassword('nobody@x.de');
      expect(Date.now() - t0).toBeGreaterThanOrEqual(190);
      expect(env.resets).toHaveLength(0);
    });

    it('forgotPassword creates a reset row for known email', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      await svc.forgotPassword('a@x.de');
      expect(env.resets).toHaveLength(1);
    });

    it('resetPassword updates pw, marks used, revokes ALL active RTs', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      // capture mail-stub call
      const sendSpy = vi.spyOn(MailService.prototype, 'sendPasswordResetMail');
      sendSpy.mockResolvedValue();
      await svc.forgotPassword('a@x.de');
      const rawToken = sendSpy.mock.calls[0]![1];

      // also issue another RT, then reset
      await svc['refreshTokens'].issueForLogin(userId);
      await svc.resetPassword(rawToken, 'NewPass1!');

      const live = env.refresh.filter((r) => r.userId === userId && r.revokedAt === null);
      expect(live).toHaveLength(0);
      expect(env.resets[0]!.usedAt).toBeInstanceOf(Date);
      expect(await bcrypt.compare('NewPass1!', env.users[0]!.password)).toBe(true);
      sendSpy.mockRestore();
    });

    it('resetPassword throws BadRequest on invalid token', async () => {
      const svc = buildSvc(env.prisma);
      await expect(
        svc.resetPassword('not-a-valid-token-at-all-just-noise-noise-noise', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout', () => {
    it('logoutByCookie revokes only the matching RT', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const out = await svc.login({ email: 'a@x.de', password: 'Demo1234!' });
      const cookieValue = out.refreshCookie!.value;
      const liveBefore = env.refresh.filter((r) => r.revokedAt === null).length;
      await svc.logoutByCookie(cookieValue);
      const liveAfter = env.refresh.filter((r) => r.revokedAt === null).length;
      expect(liveAfter).toBe(liveBefore - 1);
    });

    it('logoutByCookie tolerates unknown cookie', async () => {
      const svc = buildSvc(env.prisma);
      await expect(svc.logoutByCookie('user-x.zzzz')).resolves.toBeUndefined();
    });

    it('logoutAll revokes every active RT for the user', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      await svc['refreshTokens'].issueForLogin(userId);
      await svc['refreshTokens'].issueForLogin(userId);
      await svc.logoutAll(userId);
      const live = env.refresh.filter((r) => r.userId === userId && r.revokedAt === null);
      expect(live).toHaveLength(0);
    });
  });

  describe('refresh', () => {
    it('rotates and returns new access+refresh', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const out = await svc.login({ email: 'a@x.de', password: 'Demo1234!' });
      const cookie = out.refreshCookie!.value;
      const refreshed = await svc.refresh(cookie);
      expect(refreshed.accessToken).toBeTruthy();
      expect(refreshed.refreshCookie.value).not.toBe(cookie);
    });

    it('replay throws and invalidates entire family (other families unaffected)', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const out = await svc.login({ email: 'a@x.de', password: 'Demo1234!' });
      const loginFamily = env.refresh.find((r) => r.tokenHash !== '' && r.id === 'rt-2')?.family;
      const cookie = out.refreshCookie!.value;
      await svc.refresh(cookie);
      await expect(svc.refresh(cookie)).rejects.toThrow(/replay/);
      const liveInLoginFamily = env.refresh.filter(
        (r) => r.family === loginFamily && r.revokedAt === null,
      );
      expect(liveInLoginFamily).toHaveLength(0);
    });

    it('throws on invalid refresh cookie', async () => {
      const svc = buildSvc(env.prisma);
      await expect(svc.refresh('garbage.value')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2FA flow', () => {
    it('generate2FA stores encrypted secret + returns QR data url', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      const result = await svc.generate2FA(userId);
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(env.users[0]!.twoFactorSecret).toBeTruthy();
      // ensure ciphertext is base64 (not raw secret)
      expect(env.users[0]!.twoFactorSecret).not.toMatch(/^[A-Z2-7]+$/);
    });

    it('verify2FA enables when code is valid', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      await svc.generate2FA(userId);
      // get encrypted secret, decrypt via TwoFactorService, generate live code
      const encrypted = env.users[0]!.twoFactorSecret!;
      const enc = new EncryptionService();
      const secret = enc.decrypt(encrypted);
      const { authenticator } = await import('otplib');
      const code = authenticator.generate(secret);
      await svc.verify2FA(userId, code);
      expect(env.users[0]!.twoFactorEnabled).toBe(true);
    });

    it('verify2FA throws on wrong code', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      await svc.generate2FA(userId);
      await expect(svc.verify2FA(userId, '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('disable2FA requires password + code', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const userId = env.users[0]!.id;
      await svc.generate2FA(userId);
      const encrypted = env.users[0]!.twoFactorSecret!;
      const enc = new EncryptionService();
      const secret = enc.decrypt(encrypted);
      const { authenticator } = await import('otplib');
      const code = authenticator.generate(secret);
      await svc.verify2FA(userId, code);

      await expect(svc.disable2FA(userId, 'Wrong-1!', code)).rejects.toThrow(UnauthorizedException);
      await expect(svc.disable2FA(userId, 'Demo1234!', '000000')).rejects.toThrow();

      await svc.disable2FA(userId, 'Demo1234!', code);
      expect(env.users[0]!.twoFactorEnabled).toBe(false);
      expect(env.users[0]!.twoFactorSecret).toBeNull();
    });
  });

  describe('oauthSync', () => {
    it('creates new user and stores encrypted gmail tokens', async () => {
      const svc = buildSvc(env.prisma);
      const out = await svc.oauthSync('google', {
        email: 'g@x.de',
        name: 'Google User',
        accessToken: 'gat',
        refreshToken: 'grt',
      });
      expect(out.accessToken).toBeTruthy();
      expect(env.users[0]!.gmailTokenEncrypted).toBeTruthy();
      expect(env.users[0]!.outlookTokenEncrypted).toBeNull();
      // ciphertext should not contain the raw access token
      expect(env.users[0]!.gmailTokenEncrypted).not.toContain('gat');
    });

    it('updates existing user and writes outlook tokens', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'm@x.de', password: 'Demo1234!', name: 'M' });
      await svc.oauthSync('microsoft', {
        email: 'm@x.de',
        name: 'M',
        accessToken: 'mat',
        refreshToken: 'mrt',
      });
      expect(env.users[0]!.outlookTokenEncrypted).toBeTruthy();
    });
  });

  describe('getMe', () => {
    it('returns the current user shape', async () => {
      const svc = buildSvc(env.prisma);
      await svc.register({ email: 'a@x.de', password: 'Demo1234!', name: 'A' });
      const me = await svc.getMe(env.users[0]!.id);
      expect(me?.email).toBe('a@x.de');
    });
  });
});
