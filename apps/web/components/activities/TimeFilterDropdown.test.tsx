import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimeFilterDropdown } from './TimeFilterDropdown';
import type { ActivityFilter } from '@/lib/activities-api';

describe('TimeFilterDropdown', () => {
  it('shows "Zeitfilter" when no value selected', () => {
    render(<TimeFilterDropdown value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Zeitfilter')).toBeTruthy();
  });

  it('shows selected filter label', () => {
    render(<TimeFilterDropdown value={'today' as ActivityFilter} onChange={vi.fn()} />);
    expect(screen.getByText('Heute')).toBeTruthy();
  });

  it('opens dropdown on button click', () => {
    render(<TimeFilterDropdown value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Zeitfilter'));
    expect(screen.getByText('Ausstehend')).toBeTruthy();
    expect(screen.getByText('Überfällig')).toBeTruthy();
    expect(screen.getByText('Diese Woche')).toBeTruthy();
    expect(screen.getByText('Nächste Woche')).toBeTruthy();
  });

  it('calls onChange when a filter is selected', () => {
    const onChange = vi.fn();
    render(<TimeFilterDropdown value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('Zeitfilter'));
    fireEvent.click(screen.getByText('Heute'));
    expect(onChange).toHaveBeenCalledWith('today');
  });

  it('calls onChange with undefined when Alle is clicked', () => {
    const onChange = vi.fn();
    render(<TimeFilterDropdown value={'today' as ActivityFilter} onChange={onChange} />);
    fireEvent.click(screen.getByText('Heute'));
    fireEvent.click(screen.getByText('Alle'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows range inputs when Zeitraum selected', () => {
    render(<TimeFilterDropdown value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Zeitfilter'));
    fireEvent.click(screen.getByText('Zeitraum'));
    expect(screen.getByText('Zeitraum auswählen')).toBeTruthy();
  });
});
