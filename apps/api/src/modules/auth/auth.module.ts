import { Module, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { TwoFactorService } from './services/two-factor.service';
import { PwnedPasswordService } from './services/pwned-password.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtPre2FAStrategy } from './strategies/jwt-pre-2fa.strategy';
import { JwtSetup2FAStrategy } from './strategies/jwt-setup-2fa.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';

const oauthProviders: Provider[] = [];
if (process.env.GOOGLE_OAUTH_CLIENT_ID) oauthProviders.push(GoogleStrategy);
if (process.env.MICROSOFT_OAUTH_CLIENT_ID) oauthProviders.push(MicrosoftStrategy);

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET env var is required');
        return { secret };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshTokenService,
    TwoFactorService,
    PwnedPasswordService,
    JwtStrategy,
    JwtPre2FAStrategy,
    JwtSetup2FAStrategy,
    ...oauthProviders,
  ],
  exports: [AuthService, RefreshTokenService, JwtModule],
})
export class AuthModule {}
