import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EnrichmentBadge } from './EnrichmentBadge';
import type { EnrichmentStatus } from '@/lib/leads-api';

describe('EnrichmentBadge', () => {
  it('renders PENDING badge with correct label', () => {
    render(<EnrichmentBadge status="PENDING" />);
    expect(screen.getByText('Ausstehend')).toBeTruthy();
  });

  it('renders PROCESSING badge with spinner', () => {
    const { container } = render(<EnrichmentBadge status="PROCESSING" />);
    expect(screen.getByText('Wird angereichert...')).toBeTruthy();
    // spinner icon should be present (animate-spin class)
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders DONE badge', () => {
    render(<EnrichmentBadge status="DONE" />);
    expect(screen.getByText('Angereichert')).toBeTruthy();
  });

  it('renders FAILED badge', () => {
    render(<EnrichmentBadge status="FAILED" />);
    expect(screen.getByText('Fehlgeschlagen')).toBeTruthy();
  });

  it.each<[EnrichmentStatus, string]>([
    ['PENDING', 'bg-slate-100'],
    ['PROCESSING', 'bg-blue-100'],
    ['DONE', 'bg-green-100'],
    ['FAILED', 'bg-red-100'],
  ])('%s badge has correct color class', (status, cls) => {
    const { container } = render(<EnrichmentBadge status={status} />);
    expect(container.querySelector(`.${cls}`)).toBeTruthy();
  });

  it('PENDING does not show spinner', () => {
    const { container } = render(<EnrichmentBadge status="PENDING" />);
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});
