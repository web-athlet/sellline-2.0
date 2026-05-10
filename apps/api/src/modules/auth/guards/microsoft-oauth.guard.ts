import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class MicrosoftOAuthGuard extends AuthGuard('microsoft') {
  override canActivate(context: ExecutionContext) {
    if (!process.env.MICROSOFT_OAUTH_CLIENT_ID) {
      throw new ServiceUnavailableException('Microsoft OAuth not configured');
    }
    return super.canActivate(context);
  }
}
