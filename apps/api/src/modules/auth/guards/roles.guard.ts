import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@nextgen/db';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const ROLE_RANK: Record<Role, number> = {
  [Role.ADMIN]: 4,
  [Role.MANAGER]: 3,
  [Role.SALES_REP]: 2,
  [Role.READ_ONLY]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!user) throw new ForbiddenException('Authentication required');

    const userRank = ROLE_RANK[user.role];
    const minRequired = Math.min(...required.map((r) => ROLE_RANK[r]));
    if (userRank >= minRequired) return true;

    throw new ForbiddenException('Insufficient role');
  }
}
