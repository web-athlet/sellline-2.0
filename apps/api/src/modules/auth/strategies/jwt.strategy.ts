import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AccessTokenPayload } from '../auth.types';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET env var is required');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        passwordChangedAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const dbPwChangedAt = user.passwordChangedAt ? user.passwordChangedAt.toISOString() : null;
    if (dbPwChangedAt !== payload.pwChangedAt) {
      throw new UnauthorizedException('Token invalidated by password change');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}
