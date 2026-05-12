import { describe, it, expect } from 'vitest';
import {
  formatDueDate,
  TYPE_LABEL,
  PRIORITY_LABEL,
  FILTER_LABEL,
  TYPE_COLOR,
  type ActivityType,
  type Priority,
  type ActivityFilter,
} from './activities-api';

describe('activities-api formatters', () => {
  describe('formatDueDate', () => {
    it('returns — for null', () => {
      expect(formatDueDate(null)).toBe('—');
    });

    it('returns Heute for today', () => {
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      expect(formatDueDate(now.toISOString())).toBe('Heute');
    });

    it('returns Morgen for tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      expect(formatDueDate(tomorrow.toISOString())).toBe('Morgen');
    });

    it('returns formatted date for past dates', () => {
      const past = new Date('2024-01-15T12:00:00Z');
      const result = formatDueDate(past.toISOString());
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });
  });

  describe('TYPE_LABEL', () => {
    const types: ActivityType[] = ['CALL', 'MEETING', 'TASK', 'DEADLINE', 'EMAIL', 'LUNCH'];
    it.each(types)('has a label for %s', (type) => {
      expect(TYPE_LABEL[type]).toBeTruthy();
    });
  });

  describe('PRIORITY_LABEL', () => {
    const priorities: Priority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
    it.each(priorities)('has a label for %s', (priority) => {
      expect(PRIORITY_LABEL[priority]).toBeTruthy();
    });
  });

  describe('FILTER_LABEL', () => {
    const filters: ActivityFilter[] = [
      'todo',
      'overdue',
      'today',
      'tomorrow',
      'this_week',
      'next_week',
      'range',
    ];
    it.each(filters)('has a label for %s', (filter) => {
      expect(FILTER_LABEL[filter]).toBeTruthy();
    });
  });

  describe('TYPE_COLOR', () => {
    it('all types have hex color values', () => {
      const types: ActivityType[] = ['CALL', 'MEETING', 'TASK', 'DEADLINE', 'EMAIL', 'LUNCH'];
      types.forEach((t) => {
        expect(TYPE_COLOR[t]).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });
});
