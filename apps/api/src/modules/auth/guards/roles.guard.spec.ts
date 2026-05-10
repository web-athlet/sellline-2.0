import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@nextgen/db';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ctxWith = (user: { role: Role } | undefined): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class Dummy {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const guardWithRequired = (required: Role[] | undefined) => {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const guard = guardWithRequired(undefined);
    expect(guard.canActivate(ctxWith({ role: Role.READ_ONLY }))).toBe(true);
  });

  it('throws Forbidden when no user in request', () => {
    const guard = guardWithRequired([Role.MANAGER]);
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(ForbiddenException);
  });

  it('ADMIN passes any role requirement', () => {
    const guard = guardWithRequired([Role.MANAGER]);
    expect(guard.canActivate(ctxWith({ role: Role.ADMIN }))).toBe(true);
  });

  it('hierarchy: MANAGER passes MANAGER requirement', () => {
    const guard = guardWithRequired([Role.MANAGER]);
    expect(guard.canActivate(ctxWith({ role: Role.MANAGER }))).toBe(true);
  });

  it('hierarchy: SALES_REP fails MANAGER requirement', () => {
    const guard = guardWithRequired([Role.MANAGER]);
    expect(() => guard.canActivate(ctxWith({ role: Role.SALES_REP }))).toThrow(ForbiddenException);
  });

  it('hierarchy: READ_ONLY fails SALES_REP requirement', () => {
    const guard = guardWithRequired([Role.SALES_REP]);
    expect(() => guard.canActivate(ctxWith({ role: Role.READ_ONLY }))).toThrow(ForbiddenException);
  });

  it('uses lowest of multiple required roles (most permissive)', () => {
    const guard = guardWithRequired([Role.ADMIN, Role.SALES_REP]);
    expect(guard.canActivate(ctxWith({ role: Role.SALES_REP }))).toBe(true);
  });

  // ensures import of ROLES_KEY symbol is exercised for coverage
  it('exports ROLES_KEY', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
