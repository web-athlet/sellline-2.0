import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../../prisma/prisma.service';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_BCRYPT_COST = 10;
const REFRESH_TOKEN_TTL_DAYS = 30;

export interface IssuedRefreshToken {
  rawCookieValue: string;
  refreshTokenId: string;
  family: string;
  expiresAt: Date;
}

export interface ParsedRefreshTokenCookie {
  userId: string;
  raw: string;
}

export type RotationResult =
  | { kind: 'rotated'; userId: string; family: string; issued: IssuedRefreshToken }
  | { kind: 'replay-detected'; userId: string; family: string }
  | { kind: 'invalid' };

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  parseCookie(value: string | undefined): ParsedRefreshTokenCookie | null {
    if (!value) return null;
    const dot = value.indexOf('.');
    if (dot < 0) return null;
    const userId = value.slice(0, dot);
    const raw = value.slice(dot + 1);
    if (!userId || !raw) return null;
    return { userId, raw };
  }

  formatCookie(userId: string, raw: string): string {
    return `${userId}.${raw}`;
  }

  async issueForLogin(userId: string): Promise<IssuedRefreshToken> {
    return this.issue(userId, randomUUID());
  }

  private async issue(userId: string, family: string): Promise<IssuedRefreshToken> {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const tokenHash = await bcrypt.hash(raw, REFRESH_TOKEN_BCRYPT_COST);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    const created = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, family, expiresAt },
      select: { id: true, family: true, expiresAt: true },
    });
    return {
      rawCookieValue: this.formatCookie(userId, raw),
      refreshTokenId: created.id,
      family: created.family,
      expiresAt: created.expiresAt,
    };
  }

  async rotate(cookieValue: string | undefined): Promise<RotationResult> {
    const parsed = this.parseCookie(cookieValue);
    if (!parsed) return { kind: 'invalid' };

    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: parsed.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let matched: (typeof candidates)[number] | null = null;
    for (const c of candidates) {
      if (await bcrypt.compare(parsed.raw, c.tokenHash)) {
        matched = c;
        break;
      }
    }
    if (!matched) return { kind: 'invalid' };

    const now = new Date();
    if (matched.expiresAt <= now) return { kind: 'invalid' };

    if (matched.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { family: matched.family, revokedAt: null },
        data: { revokedAt: now },
      });
      this.logger.warn(
        `[AUTH] refresh-token replay detected — invalidated entire family family=${matched.family} user=${parsed.userId}`,
      );
      return { kind: 'replay-detected', userId: parsed.userId, family: matched.family };
    }

    const issued = await this.issue(parsed.userId, matched.family);
    await this.prisma.refreshToken.update({
      where: { id: matched.id },
      data: { revokedAt: now, replacedByToken: issued.refreshTokenId },
    });

    return { kind: 'rotated', userId: parsed.userId, family: matched.family, issued };
  }

  async revokeById(refreshTokenId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id: refreshTokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string, exceptId?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  async findByCookie(
    cookieValue: string | undefined,
  ): Promise<{ id: string; userId: string } | null> {
    const parsed = this.parseCookie(cookieValue);
    if (!parsed) return null;
    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId: parsed.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true, tokenHash: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    for (const c of candidates) {
      if (await bcrypt.compare(parsed.raw, c.tokenHash)) {
        return { id: c.id, userId: c.userId };
      }
    }
    return null;
  }

  async assertActiveOrThrow(refreshTokenId: string): Promise<void> {
    const rt = await this.prisma.refreshToken.findUnique({
      where: { id: refreshTokenId },
      select: { revokedAt: true, expiresAt: true },
    });
    if (!rt || rt.revokedAt || rt.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token is no longer active');
    }
  }
}
