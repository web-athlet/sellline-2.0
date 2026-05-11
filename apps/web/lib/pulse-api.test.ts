import { describe, expect, it } from 'vitest';
import { formatActivityType, formatCurrency, formatDueDate, todayISO } from './pulse-api';

describe('formatActivityType', () => {
  it('translates known types', () => {
    expect(formatActivityType('CALL')).toBe('Anruf');
    expect(formatActivityType('MEETING')).toBe('Meeting');
    expect(formatActivityType('TASK')).toBe('Aufgabe');
  });

  it('returns raw type for unknown values', () => {
    expect(formatActivityType('CUSTOM')).toBe('CUSTOM');
  });

  it('returns empty string for null', () => {
    expect(formatActivityType(null)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats EUR', () => {
    const result = formatCurrency(45_000, 'EUR');
    expect(result).toContain('45');
    expect(result).toContain('€');
  });

  it('defaults to EUR', () => {
    const result = formatCurrency(1000);
    expect(result).toContain('€');
  });
});

describe('formatDueDate', () => {
  it('returns empty string for null', () => {
    expect(formatDueDate(null)).toBe('');
  });

  it('returns "Heute" for today', () => {
    const today = new Date().toISOString();
    expect(formatDueDate(today)).toBe('Heute');
  });

  it('returns overdue label for past dates', () => {
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const result = formatDueDate(past);
    expect(result).toContain('überfällig');
  });
});

describe('todayISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(today).toBe(new Date().toISOString().slice(0, 10));
  });
});
