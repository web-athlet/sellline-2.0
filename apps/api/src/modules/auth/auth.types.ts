import type { Role } from '@nextgen/db';

export type JwtTokenType = 'access' | 'pre-2fa' | 'setup-2fa';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  pwChangedAt: string | null;
  type: 'access';
}

export interface Pre2FAPayload {
  sub: string;
  type: 'pre-2fa';
}

export interface Setup2FAPayload {
  sub: string;
  type: 'setup-2fa';
}

export type AnyJwtPayload = AccessTokenPayload | Pre2FAPayload | Setup2FAPayload;

export interface OAuthProfileSummary {
  email: string;
  name: string;
  accessToken: string;
  refreshToken?: string;
}
