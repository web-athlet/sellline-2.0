import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySecurityHeaders, contentSecurityPolicy, securityHeaders } from './security-headers';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('securityHeaders', () => {
  it('includes the core hardening headers', () => {
    const h = securityHeaders();
    expect(h['Strict-Transport-Security']).toContain('max-age=63072000');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Permissions-Policy']).toContain('geolocation=()');
    expect(h['Content-Security-Policy']).toContain("default-src 'self'");
  });
});

describe('contentSecurityPolicy', () => {
  it('locks down framing and objects', () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('whitelists the configured API/WS origins in connect-src', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com');
    vi.stubEnv('NEXT_PUBLIC_WS_URL', 'wss://api.example.com');
    const csp = contentSecurityPolicy();
    expect(csp).toContain('https://api.example.com');
    expect(csp).toContain('wss://api.example.com');
    expect(csp).toContain('https://api.openai.com');
  });
});

describe('applySecurityHeaders', () => {
  it('sets every header on the response', () => {
    const set = vi.fn();
    applySecurityHeaders({ headers: { set } });
    expect(set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(set.mock.calls.length).toBe(Object.keys(securityHeaders()).length);
  });
});
