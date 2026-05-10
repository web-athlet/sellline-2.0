import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { OAuthProfileSummary } from '../auth.types';

// passport-microsoft has no published typings; load via require + assert a minimal shape.
type StrategyCtor = new (
  options: Record<string, unknown>,
  verify: (
    accessToken: string,
    refreshToken: string | undefined,
    profile: unknown,
    done: (err: unknown, user?: unknown) => void,
  ) => void,
) => unknown;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const microsoftStrategyModule = require('passport-microsoft') as { Strategy: StrategyCtor };
const MicrosoftPassportStrategy = microsoftStrategyModule.Strategy as unknown as new (
  ...args: unknown[]
) => Express.User;

interface MicrosoftProfile {
  emails?: { value: string }[];
  displayName?: string;
  _json?: { mail?: string; userPrincipalName?: string; displayName?: string };
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(MicrosoftPassportStrategy, 'microsoft') {
  constructor() {
    super({
      clientID: process.env.MICROSOFT_OAUTH_CLIENT_ID ?? 'unset',
      clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET ?? 'unset',
      callbackURL:
        process.env.MICROSOFT_OAUTH_CALLBACK_URL ??
        'http://localhost:3001/api/v1/auth/microsoft/callback',
      scope: ['user.read', 'mail.read', 'offline_access'],
      tenant: 'common',
    });
  }

  validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: MicrosoftProfile,
    done: (err: unknown, user?: OAuthProfileSummary) => void,
  ): void {
    const email =
      profile.emails?.[0]?.value ?? profile._json?.mail ?? profile._json?.userPrincipalName;
    if (!email) {
      done(new Error('Microsoft profile missing email'));
      return;
    }
    const summary: OAuthProfileSummary = {
      email,
      name: profile.displayName ?? profile._json?.displayName ?? email.split('@')[0] ?? email,
      accessToken,
      refreshToken,
    };
    done(null, summary);
  }
}
