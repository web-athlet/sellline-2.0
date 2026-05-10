import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const ctx = (): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class C {},
    switchToHttp: () => ({ getRequest: () => ({}) }),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('returns true immediately when @Public() is set', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockImplementation((key: string) => key === IS_PUBLIC_KEY),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('reads the IS_PUBLIC_KEY metadata from both handler and class', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    guard.canActivate(ctx());
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      IS_PUBLIC_KEY,
      expect.arrayContaining([expect.anything(), expect.anything()]),
    );
  });
});
