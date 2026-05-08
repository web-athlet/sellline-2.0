import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins simple class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('supports conditional objects', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('merges conflicting tailwind classes (last wins)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('returns empty string when called without args', () => {
    expect(cn()).toBe('');
  });
});
