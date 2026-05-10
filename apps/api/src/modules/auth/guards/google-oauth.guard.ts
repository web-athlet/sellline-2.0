import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  override canActivate(context: ExecutionContext) {
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
      throw new ServiceUnavailableException('Google OAuth not configured');
    }
    return super.canActivate(context);
  }
}
