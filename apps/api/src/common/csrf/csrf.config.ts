import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Routes exempt from CSRF: the unauthenticated auth-bootstrap endpoints (the SPA
 * cannot hold a token before logging in) plus the public/webhook surface. All
 * other state-changing cookie requests (e.g. logout) require a valid token.
 * Bearer-token API calls are exempt separately — they are inherently CSRF-safe.
 */
const SKIP_PATHS = [
  '/public',
  '/webhooks',
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/2fa',
];

/** Pure, testable skip predicate used by the CSRF middleware. */
export function shouldSkipCsrf(req: Pick<Request, 'headers' | 'originalUrl' | 'url'>): boolean {
  const auth = req.headers?.['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return true;
  const url = req.originalUrl ?? req.url ?? '';
  return SKIP_PATHS.some((p) => url.includes(p));
}

// `__Host-` cookies require Secure, which browsers reject over plain http — so the
// strict name/flags are only used in production; dev falls back to a plain cookie.
export const CSRF_COOKIE_NAME = isProd ? '__Host-csrf' : 'csrf';

export const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET ?? process.env.JWT_SECRET ?? 'dev-csrf-secret-change-me',
  getSessionIdentifier: (req) => (req.cookies as Record<string, string> | undefined)?.rt ?? '',
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: { sameSite: 'strict', secure: isProd, httpOnly: true, path: '/' },
  size: 64,
  skipCsrfProtection: shouldSkipCsrf,
});
