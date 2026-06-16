import { extractEntity, redact, redactCapped } from './audit.util';

describe('audit.util', () => {
  describe('redact', () => {
    it('redacts password / token / secret keys at any depth', () => {
      const out = redact({
        email: 'a@b.de',
        password: 'hunter2',
        nested: { refreshToken: 'x', twoFactorSecret: 'y', keep: 1 },
      }) as Record<string, unknown>;
      expect(out.email).toBe('a@b.de');
      expect(out.password).toBe('[REDACTED]');
      const nested = out.nested as Record<string, unknown>;
      expect(nested.refreshToken).toBe('[REDACTED]');
      expect(nested.twoFactorSecret).toBe('[REDACTED]');
      expect(nested.keep).toBe(1);
    });

    it('normalises Date to ISO string', () => {
      const d = new Date('2026-06-16T00:00:00.000Z');
      expect(redact({ at: d })).toEqual({ at: '2026-06-16T00:00:00.000Z' });
    });

    it('handles arrays and primitives', () => {
      expect(redact([1, 'a', { token: 't' }])).toEqual([1, 'a', { token: '[REDACTED]' }]);
    });

    it('drops circular references instead of throwing', () => {
      const a: Record<string, unknown> = { name: 'x' };
      a.self = a;
      const out = redact(a) as Record<string, unknown>;
      expect(out.name).toBe('x');
      expect(out.self).toBeUndefined();
    });
  });

  describe('redactCapped', () => {
    it('returns a marker for oversized payloads', () => {
      const big = { blob: 'x'.repeat(70 * 1024) };
      expect(redactCapped(big)).toEqual({ truncated: true });
    });

    it('passes through small redacted payloads', () => {
      expect(redactCapped({ password: 'p', id: '1' })).toEqual({ password: '[REDACTED]', id: '1' });
    });
  });

  describe('extractEntity', () => {
    it('strips api/version and returns the resource segment', () => {
      expect(extractEntity('/api/v1/deals/:id')).toBe('deals');
      expect(extractEntity('/contacts')).toBe('contacts');
    });

    it('falls back to unknown for empty/param-first paths', () => {
      expect(extractEntity('')).toBe('unknown');
      expect(extractEntity('/api/v1/:id')).toBe('unknown');
    });
  });
});
