import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Role } from '@nextgen/db';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { MailService } from '../../mail/mail.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { TwoFactorService } from './services/two-factor.service';
import type {
  AccessTokenPayload,
  OAuthProfileSummary,
  Pre2FAPayload,
  Setup2FAPayload,
} from './auth.types';

const PASSWORD_BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TTL ?? '15m';
const PRE_2FA_TTL = '1m';
const SETUP_2FA_TTL = '5m';
const FORGOT_PASSWORD_FLOOR_MS = 200;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_BCRYPT_COST = 10;

export interface LoginOutcome {
  status: 'authenticated' | 'requires-2fa' | 'requires-2fa-setup';
  accessToken?: string;
  preAuthToken?: string;
  setupToken?: string;
  refreshCookie?: { value: string; expiresAt: Date };
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    twoFactorEnabled: boolean;
  };
}

export interface AuthSuccess {
  accessToken: string;
  refreshCookie: { value: string; expiresAt: Date };
  user: { id: string; email: string; name: string; role: Role; twoFactorEnabled: boolean };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly twoFactor: TwoFactorService,
    private readonly encryption: EncryptionService,
    private readonly mail: MailService,
  ) {}

  // ── Registration ────────────────────────────────────────────────────────
  async register(input: { email: string; password: string; name: string }): Promise<AuthSuccess> {
    const existing = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Email already registered');

    const password = await bcrypt.hash(input.password, PASSWORD_BCRYPT_COST);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password,
        role: Role.SALES_REP,
        passwordChangedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        passwordChangedAt: true,
      },
    });

    return this.buildAuthSuccess(user);
  }

  // ── Login ───────────────────────────────────────────────────────────────
  async login(input: { email: string; password: string }): Promise<LoginOutcome> {
    const user = await this.prisma.user.findFirst({
      where: { email: input.email, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        passwordChangedAt: true,
        twoFactorEnabled: true,
      },
    });
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userPublic = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    };

    if (user.role === Role.ADMIN && !user.twoFactorEnabled) {
      const setupToken = this.signSetup2FAToken(user.id);
      return { status: 'requires-2fa-setup', setupToken, user: userPublic };
    }

    if (user.twoFactorEnabled) {
      const preAuthToken = this.signPre2FAToken(user.id);
      return { status: 'requires-2fa', preAuthToken, user: userPublic };
    }

    const success = await this.buildAuthSuccess({ ...user });
    return {
      status: 'authenticated',
      accessToken: success.accessToken,
      refreshCookie: success.refreshCookie,
      user: success.user,
    };
  }

  async loginAfter2FA(userId: string, code: string): Promise<AuthSuccess> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        passwordChangedAt: true,
      },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA not enabled');
    }
    const secret = this.twoFactor.decryptSecret(user.twoFactorSecret);
    if (!this.twoFactor.verifyToken(secret, code)) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    return this.buildAuthSuccess(user);
  }

  // ── Refresh ─────────────────────────────────────────────────────────────
  async refresh(cookieValue: string | undefined): Promise<AuthSuccess> {
    const result = await this.refreshTokens.rotate(cookieValue);
    if (result.kind === 'invalid') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (result.kind === 'replay-detected') {
      throw new UnauthorizedException('Refresh token replay detected — family invalidated');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: result.userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        passwordChangedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const accessToken = this.signAccessToken(user);
    return {
      accessToken,
      refreshCookie: {
        value: result.issued.rawCookieValue,
        expiresAt: result.issued.expiresAt,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  // ── Logout ──────────────────────────────────────────────────────────────
  async logoutByCookie(cookieValue: string | undefined): Promise<void> {
    const found = await this.refreshTokens.findByCookie(cookieValue);
    if (found) await this.refreshTokens.revokeById(found.id);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }

  // ── Password reset ──────────────────────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const start = Date.now();
    const user = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true },
    });
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, PASSWORD_RESET_BCRYPT_COST);
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      await this.mail.sendPasswordResetMail(user.email, rawToken);
    }
    const elapsed = Date.now() - start;
    if (elapsed < FORGOT_PASSWORD_FLOOR_MS) {
      await sleep(FORGOT_PASSWORD_FLOOR_MS - elapsed);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const candidates = await this.prisma.passwordReset.findMany({
      where: { expiresAt: { gt: new Date() }, usedAt: null },
      select: { id: true, userId: true, tokenHash: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    let matched: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await bcrypt.compare(token, c.tokenHash)) {
        matched = c;
        break;
      }
    }
    if (!matched) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_COST);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: matched.userId },
        data: { password: passwordHash, passwordChangedAt: now },
      }),
      this.prisma.passwordReset.update({
        where: { id: matched.id },
        data: { usedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: matched.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<AuthSuccess> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        passwordChangedAt: true,
        twoFactorEnabled: true,
      },
    });
    if (!user || !(await bcrypt.compare(oldPassword, user.password))) {
      throw new UnauthorizedException('Old password is invalid');
    }
    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_BCRYPT_COST);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: passwordHash, passwordChangedAt: now },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);
    return this.buildAuthSuccess({ ...user, passwordChangedAt: now });
  }

  // ── 2FA ─────────────────────────────────────────────────────────────────
  async generate2FA(userId: string): Promise<{ qrCodeDataUrl: string; otpauthUri: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true },
    });
    if (!user) throw new UnauthorizedException();

    const secret = this.twoFactor.generateSecret();
    const encrypted = this.twoFactor.encryptSecret(secret);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: encrypted, twoFactorEnabled: false },
    });
    const { uri, dataUrl } = await this.twoFactor.generateQrCodeDataUrl(user.email, secret);
    return { qrCodeDataUrl: dataUrl, otpauthUri: uri };
  }

  async verify2FA(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { twoFactorSecret: true },
    });
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA not initialized');
    const secret = this.twoFactor.decryptSecret(user.twoFactorSecret);
    if (!this.twoFactor.verifyToken(secret, code)) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disable2FA(userId: string, password: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { password: true, twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not enabled');
    }
    if (!(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Password mismatch');
    }
    const secret = this.twoFactor.decryptSecret(user.twoFactorSecret);
    if (!this.twoFactor.verifyToken(secret, code)) {
      throw new UnauthorizedException('Invalid 2FA code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  // ── OAuth ───────────────────────────────────────────────────────────────
  async oauthSync(
    provider: 'google' | 'microsoft',
    profile: OAuthProfileSummary,
  ): Promise<AuthSuccess> {
    const tokenJson = JSON.stringify({
      accessToken: profile.accessToken,
      refreshToken: profile.refreshToken,
    });
    const encryptedTokens = this.encryption.encrypt(tokenJson);

    let user = await this.prisma.user.findFirst({
      where: { email: profile.email, deletedAt: null },
    });
    if (!user) {
      const placeholderPassword = await bcrypt.hash(
        randomBytes(16).toString('hex'),
        PASSWORD_BCRYPT_COST,
      );
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          password: placeholderPassword,
          role: Role.SALES_REP,
          passwordChangedAt: new Date(),
          ...(provider === 'google'
            ? { gmailTokenEncrypted: encryptedTokens }
            : { outlookTokenEncrypted: encryptedTokens }),
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data:
          provider === 'google'
            ? { gmailTokenEncrypted: encryptedTokens }
            : { outlookTokenEncrypted: encryptedTokens },
      });
    }

    return this.buildAuthSuccess(user);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  }

  signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
    passwordChangedAt: Date | null;
  }): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      pwChangedAt: user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null,
      type: 'access',
    };
    return this.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
  }

  signPre2FAToken(userId: string): string {
    const payload: Pre2FAPayload = { sub: userId, type: 'pre-2fa' };
    return this.jwt.sign(payload, { expiresIn: PRE_2FA_TTL });
  }

  signSetup2FAToken(userId: string): string {
    const payload: Setup2FAPayload = { sub: userId, type: 'setup-2fa' };
    return this.jwt.sign(payload, { expiresIn: SETUP_2FA_TTL });
  }

  private async buildAuthSuccess(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    twoFactorEnabled: boolean;
    passwordChangedAt: Date | null;
  }): Promise<AuthSuccess> {
    const accessToken = this.signAccessToken(user);
    const issued = await this.refreshTokens.issueForLogin(user.id);
    return {
      accessToken,
      refreshCookie: { value: issued.rawCookieValue, expiresAt: issued.expiresAt },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
