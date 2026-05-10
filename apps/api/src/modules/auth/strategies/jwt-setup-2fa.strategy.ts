import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Setup2FAPayload } from '../auth.types';

@Injectable()
export class JwtSetup2FAStrategy extends PassportStrategy(Strategy, 'jwt-setup-2fa') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET env var is required');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: Setup2FAPayload): { id: string } {
    if (payload.type !== 'setup-2fa') {
      throw new UnauthorizedException('Invalid token type');
    }
    return { id: payload.sub };
  }
}
