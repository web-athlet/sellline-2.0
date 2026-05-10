import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
});

const mockResponse = () => {
  const cookies: Record<string, { value: string; opts: unknown }> = {};
  const cleared: string[] = [];
  const redirected: string[] = [];
  const res = {
    cookie: vi.fn((name: string, value: string, opts: unknown) => {
      cookies[name] = { value, opts };
      return res;
    }),
    clearCookie: vi.fn((name: string) => {
      cleared.push(name);
      return res;
    }),
    redirect: vi.fn((url: string) => {
      redirected.push(url);
    }),
  } as unknown as Response;
  return { res, cookies, cleared, redirected };
};

const stubAuth = (overrides: Partial<AuthService> = {}): AuthService =>
  ({
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logoutByCookie: vi.fn(),
    logoutAll: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    changePassword: vi.fn(),
    getMe: vi.fn(),
    generate2FA: vi.fn(),
    verify2FA: vi.fn(),
    loginAfter2FA: vi.fn(),
    disable2FA: vi.fn(),
    oauthSync: vi.fn(),
    ...overrides,
  }) as unknown as AuthService;

describe('AuthController', () => {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const refreshCookie = { value: 'u-1.token', expiresAt };
  const userPublic = {
    id: 'u-1',
    email: 'a@x.de',
    name: 'A',
    role: 'SALES_REP' as const,
    twoFactorEnabled: false,
  };

  it('register sets cookie + returns access+user', async () => {
    const auth = stubAuth({
      register: vi.fn().mockResolvedValue({ accessToken: 'at', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res, cookies } = mockResponse();
    const out = await ctrl.register({ name: 'A', email: 'a@x.de', password: 'Demo1234!' }, res);
    expect(out).toEqual({ accessToken: 'at', user: userPublic });
    expect(cookies.rt?.value).toBe('u-1.token');
  });

  it('login authenticated → access + cookie', async () => {
    const auth = stubAuth({
      login: vi.fn().mockResolvedValue({
        status: 'authenticated',
        accessToken: 'at',
        refreshCookie,
        user: userPublic,
      }),
    });
    const ctrl = new AuthController(auth);
    const { res, cookies } = mockResponse();
    const out = await ctrl.login({ email: 'a@x.de', password: 'Demo1234!' }, res);
    expect(out).toEqual({ accessToken: 'at', user: userPublic });
    expect(cookies.rt?.value).toBe('u-1.token');
  });

  it('login requires-2fa → no cookie', async () => {
    const auth = stubAuth({
      login: vi
        .fn()
        .mockResolvedValue({ status: 'requires-2fa', preAuthToken: 'pre', user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res, cookies } = mockResponse();
    const out = await ctrl.login({ email: 'a@x.de', password: 'x' }, res);
    expect(out).toEqual({ requires2FA: true, preAuthToken: 'pre', user: userPublic });
    expect(cookies.rt).toBeUndefined();
  });

  it('login requires-2fa-setup → no cookie', async () => {
    const auth = stubAuth({
      login: vi
        .fn()
        .mockResolvedValue({ status: 'requires-2fa-setup', setupToken: 'setup', user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res } = mockResponse();
    const out = await ctrl.login({ email: 'a@x.de', password: 'x' }, res);
    expect(out).toEqual({ requires2FASetup: true, setupToken: 'setup', user: userPublic });
  });

  it('refresh reads cookie and rotates', async () => {
    const auth = stubAuth({
      refresh: vi.fn().mockResolvedValue({ accessToken: 'at2', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res } = mockResponse();
    const req = { cookies: { rt: 'u-1.tok' } } as unknown as Request;
    const out = await ctrl.refresh(req, res);
    expect(out).toEqual({ accessToken: 'at2', user: userPublic });
    expect(auth.refresh).toHaveBeenCalledWith('u-1.tok');
  });

  it('logout clears cookie + revokes by cookie', async () => {
    const auth = stubAuth();
    const ctrl = new AuthController(auth);
    const { res, cleared } = mockResponse();
    const req = { cookies: { rt: 'u-1.tok' } } as unknown as Request;
    await ctrl.logout(req, res);
    expect(auth.logoutByCookie).toHaveBeenCalledWith('u-1.tok');
    expect(cleared).toContain('rt');
  });

  it('logout-all delegates + clears cookie', async () => {
    const auth = stubAuth();
    const ctrl = new AuthController(auth);
    const { res } = mockResponse();
    await ctrl.logoutAll({ id: 'u-1', email: 'a', role: 'ADMIN', twoFactorEnabled: true }, res);
    expect(auth.logoutAll).toHaveBeenCalledWith('u-1');
  });

  it('forgot-password forwards email', async () => {
    const auth = stubAuth();
    const ctrl = new AuthController(auth);
    await ctrl.forgotPassword({ email: 'a@x.de' });
    expect(auth.forgotPassword).toHaveBeenCalledWith('a@x.de');
  });

  it('reset-password forwards token + newPassword', async () => {
    const auth = stubAuth();
    const ctrl = new AuthController(auth);
    await ctrl.resetPassword({ token: 'a'.repeat(64), newPassword: 'NewPass1!' });
    expect(auth.resetPassword).toHaveBeenCalledWith('a'.repeat(64), 'NewPass1!');
  });

  it('change-password sets cookie + returns new pair', async () => {
    const auth = stubAuth({
      changePassword: vi
        .fn()
        .mockResolvedValue({ accessToken: 'at3', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res, cookies } = mockResponse();
    const out = await ctrl.changePassword(
      { id: 'u-1', email: 'a', role: 'ADMIN', twoFactorEnabled: false },
      { oldPassword: 'Demo1234!', newPassword: 'NewPass1!' },
      res,
    );
    expect(out).toEqual({ accessToken: 'at3', user: userPublic });
    expect(cookies.rt?.value).toBe('u-1.token');
  });

  it('me returns current user', async () => {
    const auth = stubAuth({
      getMe: vi.fn().mockResolvedValue({ id: 'u-1', email: 'a@x.de' }),
    });
    const ctrl = new AuthController(auth);
    const out = await ctrl.me({
      id: 'u-1',
      email: 'a@x.de',
      role: 'ADMIN',
      twoFactorEnabled: false,
    });
    expect(out).toEqual({ id: 'u-1', email: 'a@x.de' });
  });

  it('me throws if user vanished', async () => {
    const auth = stubAuth({ getMe: vi.fn().mockResolvedValue(null) });
    const ctrl = new AuthController(auth);
    await expect(
      ctrl.me({ id: 'u-1', email: 'a@x.de', role: 'ADMIN', twoFactorEnabled: false }),
    ).rejects.toThrow();
  });

  it('2fa/generate delegates', async () => {
    const auth = stubAuth({
      generate2FA: vi
        .fn()
        .mockResolvedValue({ qrCodeDataUrl: 'data:...', otpauthUri: 'otpauth://...' }),
    });
    const ctrl = new AuthController(auth);
    const out = await ctrl.generate2FA({
      id: 'u-1',
      email: 'a',
      role: 'ADMIN',
      twoFactorEnabled: false,
    });
    expect(out.qrCodeDataUrl).toBeTruthy();
  });

  it('2fa/verify returns enabled', async () => {
    const auth = stubAuth();
    const ctrl = new AuthController(auth);
    const out = await ctrl.verify2FA(
      { id: 'u-1', email: 'a', role: 'ADMIN', twoFactorEnabled: false },
      { code: '123456' },
    );
    expect(out).toEqual({ enabled: true });
  });

  it('2fa/disable returns disabled', async () => {
    const auth = stubAuth();
    const ctrl = new AuthController(auth);
    const out = await ctrl.disable2FA(
      { id: 'u-1', email: 'a', role: 'ADMIN', twoFactorEnabled: true },
      { password: 'Demo1234!', code: '123456' },
    );
    expect(out).toEqual({ enabled: false });
  });

  it('2fa/setup-generate uses request user', async () => {
    const auth = stubAuth({
      generate2FA: vi.fn().mockResolvedValue({ qrCodeDataUrl: 'd', otpauthUri: 'o' }),
    });
    const ctrl = new AuthController(auth);
    const req = { user: { id: 'u-99' } } as unknown as Request;
    await ctrl.generate2FAFromSetup(req);
    expect(auth.generate2FA).toHaveBeenCalledWith('u-99');
  });

  it('2fa/setup-verify enables + issues tokens', async () => {
    const auth = stubAuth({
      verify2FA: vi.fn().mockResolvedValue(undefined),
      loginAfter2FA: vi
        .fn()
        .mockResolvedValue({ accessToken: 'at', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const req = { user: { id: 'u-99' } } as unknown as Request;
    const { res, cookies } = mockResponse();
    const out = await ctrl.verify2FAFromSetup(req, { code: '123456' }, res);
    expect(out.accessToken).toBe('at');
    expect(cookies.rt?.value).toBe('u-1.token');
  });

  it('2fa/validate issues access+refresh', async () => {
    const auth = stubAuth({
      loginAfter2FA: vi
        .fn()
        .mockResolvedValue({ accessToken: 'at', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const req = { user: { id: 'u-1' } } as unknown as Request;
    const { res, cookies } = mockResponse();
    const out = await ctrl.validate2FA(req, { code: '123456' }, res);
    expect(out.accessToken).toBe('at');
    expect(cookies.rt?.value).toBe('u-1.token');
  });

  it('google start handler is a no-op (guard handles redirect)', () => {
    const ctrl = new AuthController(stubAuth());
    expect(ctrl.googleStart()).toBeUndefined();
    expect(ctrl.microsoftStart()).toBeUndefined();
  });

  it('google callback issues tokens + redirects to web', async () => {
    const auth = stubAuth({
      oauthSync: vi
        .fn()
        .mockResolvedValue({ accessToken: 'g-at', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res, redirected, cookies } = mockResponse();
    const req = {
      user: { email: 'g@x.de', name: 'G', accessToken: 'a', refreshToken: 'r' },
    } as unknown as Request;
    await ctrl.googleCallback(req, res);
    expect(auth.oauthSync).toHaveBeenCalledWith(
      'google',
      expect.objectContaining({ email: 'g@x.de' }),
    );
    expect(cookies.rt?.value).toBe('u-1.token');
    expect(redirected[0]).toContain('/auth/oauth-callback?at=');
  });

  it('microsoft callback issues tokens + redirects', async () => {
    const auth = stubAuth({
      oauthSync: vi
        .fn()
        .mockResolvedValue({ accessToken: 'm-at', refreshCookie, user: userPublic }),
    });
    const ctrl = new AuthController(auth);
    const { res, redirected } = mockResponse();
    const req = {
      user: { email: 'm@x.de', name: 'M', accessToken: 'a' },
    } as unknown as Request;
    await ctrl.microsoftCallback(req, res);
    expect(auth.oauthSync).toHaveBeenCalledWith(
      'microsoft',
      expect.objectContaining({ email: 'm@x.de' }),
    );
    expect(redirected[0]).toContain('at=');
  });
});
