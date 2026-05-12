import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ActivityTypeIcon } from './ActivityTypeIcon';
import type { ActivityType } from '@/lib/activities-api';

const TYPES: ActivityType[] = ['CALL', 'MEETING', 'TASK', 'DEADLINE', 'EMAIL', 'LUNCH'];

describe('ActivityTypeIcon', () => {
  it.each(TYPES)('renders without crashing for type %s', (type) => {
    const { container } = render(<ActivityTypeIcon type={type} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(<ActivityTypeIcon type="CALL" className="h-6 w-6 text-red-500" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('text-red-500');
  });

  it('uses default className when not provided', () => {
    const { container } = render(<ActivityTypeIcon type="MEETING" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('h-4 w-4');
  });
});
