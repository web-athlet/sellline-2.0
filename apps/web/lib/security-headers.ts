/**
 * Centralised HTTP security headers applied to every response by the Next.js
 * middleware. A pragmatic CSP is used (no per-request script nonce yet — that
 * requires layout/runtime wiring and is tracked as follow-up tech-debt).
 */

function connectSrc(): string {
  const sources = new Set(["'self'", 'https://api.openai.com']);
  const api = process.env.NEXT_PUBLIC_API_URL;
  const ws = process.env.NEXT_PUBLIC_WS_URL;
  if (api) sources.add(api);
  if (ws) sources.add(ws);
  // WebSocket upgrade of the API origin during local/dev.
  if (api?.startsWith('http')) sources.add(api.replace(/^http/, 'ws'));
  return Array.from(sources).join(' ');
}

export function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc()}`,
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

export function securityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': contentSecurityPolicy(),
  };
}

export function applySecurityHeaders(res: {
  headers: { set(key: string, value: string): void };
}): void {
  for (const [key, value] of Object.entries(securityHeaders())) {
    res.headers.set(key, value);
  }
}
