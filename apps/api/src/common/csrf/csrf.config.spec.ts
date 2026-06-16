import type { Request } from 'express';
import { CSRF_COOKIE_NAME, doubleCsrfProtection, shouldSkipCsrf } from './csrf.config';

const req = (over: Partial<Pick<Request, 'headers' | 'originalUrl' | 'url'>>) =>
  ({ headers: {}, url: '', originalUrl: '', ...over }) as Pick<
    Request,
    'headers' | 'originalUrl' | 'url'
  >;

describe('shouldSkipCsrf', () => {
  it('skips Bearer-token API requests (CSRF-immune)', () => {
    expect(
      shouldSkipCsrf(
        req({ headers: { authorization: 'Bearer abc' }, originalUrl: '/api/v1/deals' }),
      ),
    ).toBe(true);
  });

  it('skips public and webhook routes', () => {
    expect(shouldSkipCsrf(req({ originalUrl: '/api/v1/public/forms/1/submit' }))).toBe(true);
    expect(shouldSkipCsrf(req({ originalUrl: '/api/v1/webhooks/gmail' }))).toBe(true);
  });

  it('skips unauthenticated auth-bootstrap routes', () => {
    for (const p of [
      'login',
      'register',
      'refresh',
      'forgot-password',
      'reset-password',
      '2fa/validate',
    ]) {
      expect(shouldSkipCsrf(req({ originalUrl: `/api/v1/auth/${p}` }))).toBe(true);
    }
  });

  it('protects cookie-based mutating routes such as logout', () => {
    expect(shouldSkipCsrf(req({ originalUrl: '/api/v1/auth/logout' }))).toBe(false);
  });

  it('exposes the middleware and a cookie name', () => {
    expect(typeof doubleCsrfProtection).toBe('function');
    expect(CSRF_COOKIE_NAME).toMatch(/csrf/);
  });
});
