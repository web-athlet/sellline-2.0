import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { applySecurityHeaders } from './lib/security-headers';

function secured(res: NextResponse): NextResponse {
  applySecurityHeaders(res);
  return res;
}

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/2fa-challenge',
  '/2fa-setup',
  '/auth/oauth-callback',
];

export const config = {
  matcher: ['/((?!api|_next|favicon.ico|.*\\..*).*)'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return secured(NextResponse.next());
  }
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return secured(NextResponse.redirect(url));
  }
  return secured(NextResponse.next());
}
