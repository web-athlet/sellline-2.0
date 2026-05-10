import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type VerifyCallback } from 'passport-google-oauth20';
import type { OAuthProfileSummary } from '../auth.types';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? 'unset',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? 'unset',
      callbackURL:
        process.env.GOOGLE_OAUTH_CALLBACK_URL ??
        'http://localhost:3001/api/v1/auth/google/callback',
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.readonly'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: { emails?: { value: string }[]; displayName?: string; name?: { givenName?: string } },
    done: VerifyCallback,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google profile missing email'), false);
      return;
    }
    const summary: OAuthProfileSummary = {
      email,
      name: profile.displayName ?? profile.name?.givenName ?? email.split('@')[0] ?? email,
      accessToken,
      refreshToken,
    };
    done(null, summary);
  }
}
