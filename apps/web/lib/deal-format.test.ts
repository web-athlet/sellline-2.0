import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, scoreColor } from './deal-format';

describe('formatCurrency', () => {
  it('formats numbers as EUR by default', () => {
    expect(formatCurrency(1234)).toMatch(/1\.234/);
    expect(formatCurrency(1234)).toContain('€');
  });

  it('accepts string input from Prisma Decimal', () => {
    expect(formatCurrency('500.50')).toMatch(/501|500/);
  });

  it('falls back to €0 when value is not finite', () => {
    expect(formatCurrency('NaN')).toBe('€0');
  });

  it('honours non-default currency', () => {
    const formatted = formatCurrency(100, 'USD');
    expect(formatted).toMatch(/100/);
  });
});

describe('formatDate', () => {
  it('returns — for null/invalid', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('invalid-date')).toBe('—');
  });

  it('formats ISO strings as de-DE', () => {
    expect(formatDate('2026-05-11T00:00:00Z')).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });
});

describe('scoreColor', () => {
  it('grey for low', () => {
    expect(scoreColor(10)).toContain('slate');
  });
  it('amber for mid', () => {
    expect(scoreColor(50)).toContain('amber');
  });
  it('emerald for high', () => {
    expect(scoreColor(90)).toContain('emerald');
  });
});
