import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Role } from '@nextgen/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  refreshTokenId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
